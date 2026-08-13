mod geometry;
mod settings;

use std::{fs, path::PathBuf};

use geometry::{clamp_x, clamp_y, move_horizontal, MoveResult, Rect, WindowGeometry};
use settings::{Direction, PetSettings};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};
use tauri::window::Color;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

const WINDOW_LABEL: &str = "main";
const SETTINGS_FILE: &str = "settings.json";
const DEFAULT_WIDTH: f64 = 288.0;
const DEFAULT_HEIGHT: f64 = 312.0;

#[cfg(target_os = "windows")]
mod windows_drag {
    use std::{thread, time::Duration};

    const VK_LBUTTON: i32 = 0x01;

    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(v_key: i32) -> i16;
    }

    fn left_button_is_down() -> bool {
        (unsafe { GetAsyncKeyState(VK_LBUTTON) } as u16 & 0x8000) != 0
    }

    pub fn wait_for_left_button_release() {
        while left_button_is_down() {
            thread::sleep(Duration::from_millis(16));
        }
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(SETTINGS_FILE))
        .map_err(|error| format!("无法定位之之的设置目录：{error}"))
}

fn monitor_rect(monitor: &tauri::window::Monitor) -> Rect {
    let area = monitor.work_area();
    Rect {
        x: area.position.x,
        y: area.position.y,
        width: area.size.width,
        height: area.size.height,
    }
}

fn monitor_for_window(window: &WebviewWindow) -> Result<tauri::window::Monitor, String> {
    if let Some(monitor) = window
        .current_monitor()
        .map_err(|error| format!("无法读取当前显示器：{error}"))?
    {
        return Ok(monitor);
    }

    window
        .primary_monitor()
        .map_err(|error| format!("无法读取主显示器：{error}"))?
        .ok_or_else(|| "没有找到可用的显示器".to_string())
}

fn monitor_named(window: &WebviewWindow, name: Option<&str>) -> Option<tauri::window::Monitor> {
    let expected = name?;
    window
        .available_monitors()
        .ok()?
        .into_iter()
        .find(|monitor| monitor.name().map(String::as_str) == Some(expected))
}

fn window_geometry(window: &WebviewWindow) -> Result<WindowGeometry, String> {
    let position = window
        .outer_position()
        .map_err(|error| format!("无法读取之之的位置：{error}"))?;
    let size = window
        .outer_size()
        .map_err(|error| format!("无法读取之之的大小：{error}"))?;
    Ok(WindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

fn position_window(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    monitor_name: Option<String>,
    hit_edge: bool,
) -> Result<MoveResult, String> {
    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| format!("无法移动之之：{error}"))?;
    Ok(MoveResult {
        hit_edge,
        x,
        y,
        monitor_name,
    })
}

fn bottom_right(
    window: &WebviewWindow,
    monitor: &tauri::window::Monitor,
) -> Result<MoveResult, String> {
    let area = monitor_rect(monitor);
    let geometry = window_geometry(window)?;
    position_window(
        window,
        clamp_x(i32::MAX, area, geometry.width),
        geometry::bottom_y(area, geometry.height),
        monitor.name().cloned(),
        false,
    )
}

fn restore_window(window: &WebviewWindow, settings: &PetSettings) -> Result<MoveResult, String> {
    let monitor = monitor_named(window, settings.monitor_name.as_deref())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "没有找到可用的显示器".to_string())?;
    let area = monitor_rect(&monitor);
    let geometry = window_geometry(window)?;

    match (settings.x, settings.y) {
        (Some(x), Some(y)) => position_window(
            window,
            clamp_x(x, area, geometry.width),
            if settings.paused {
                clamp_y(y, area, geometry.height)
            } else {
                geometry::bottom_y(area, geometry.height)
            },
            monitor.name().cloned(),
            false,
        ),
        _ => bottom_right(window, &monitor),
    }
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<PetSettings, String> {
    settings::load(&config_path(&app)?)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: PetSettings) -> Result<(), String> {
    settings::save(&config_path(&app)?, &settings)
}

#[tauri::command]
fn move_step(
    window: WebviewWindow,
    direction: Direction,
    delta: f64,
) -> Result<MoveResult, String> {
    let monitor = monitor_for_window(&window)?;
    let scale_factor = monitor.scale_factor();
    let physical_delta = (delta.max(0.0) * scale_factor).round().max(1.0) as i32;
    let signed_delta = match direction {
        Direction::Left => -physical_delta,
        Direction::Right => physical_delta,
    };
    let (moved, hit_edge) = move_horizontal(
        window_geometry(&window)?,
        monitor_rect(&monitor),
        signed_delta,
    );
    position_window(&window, moved.x, moved.y, monitor.name().cloned(), hit_edge)
}

#[tauri::command]
async fn start_pet_drag(window: WebviewWindow) -> Result<(), String> {
    window
        .start_dragging()
        .map_err(|error| format!("无法拖动之之：{error}"))?;

    // Tauri posts the native drag request before it returns. On Windows, wait on
    // a blocking worker until the real mouse release so the caller snaps only
    // after the user has finished placing the pet.
    #[cfg(target_os = "windows")]
    tauri::async_runtime::spawn_blocking(windows_drag::wait_for_left_button_release)
        .await
        .map_err(|error| format!("无法等待拖动结束：{error}"))?;

    Ok(())
}

#[tauri::command]
fn finish_dragging(window: WebviewWindow, paused: bool) -> Result<MoveResult, String> {
    let monitor = monitor_for_window(&window)?;
    let area = monitor_rect(&monitor);
    let geometry = window_geometry(&window)?;
    position_window(
        &window,
        clamp_x(geometry.x, area, geometry.width),
        if paused {
            clamp_y(geometry.y, area, geometry.height)
        } else {
            geometry::bottom_y(area, geometry.height)
        },
        monitor.name().cloned(),
        false,
    )
}

#[tauri::command]
fn resize_pet(window: WebviewWindow, size_scale: f64, paused: bool) -> Result<(), String> {
    let scale = if [0.8, 1.0, 1.25]
        .iter()
        .any(|allowed| (size_scale - allowed).abs() < f64::EPSILON)
    {
        size_scale
    } else {
        1.0
    };
    window
        .set_size(Size::Logical(tauri::LogicalSize::new(
            DEFAULT_WIDTH * scale,
            DEFAULT_HEIGHT * scale,
        )))
        .map_err(|error| format!("无法调整之之的大小：{error}"))?;
    finish_dragging(window, paused).map(|_| ())
}

#[tauri::command]
fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager
            .enable()
            .map_err(|error| format!("无法开启开机启动：{error}"))?;
    } else {
        manager
            .disable()
            .map_err(|error| format!("无法关闭开机启动：{error}"))?;
    }
    manager
        .is_enabled()
        .map_err(|error| format!("无法确认开机启动状态：{error}"))
}

#[tauri::command]
fn reset_position(window: WebviewWindow) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| format!("无法读取主显示器：{error}"))?
        .ok_or_else(|| "没有找到主显示器".to_string())?;
    bottom_right(&window, &monitor).map(|_| ())
}

#[tauri::command]
fn show_about(app: AppHandle) {
    app.dialog()
        .message(
            "之之桌面宠物 0.1.0\n\n以之之的真实照片为原型制作。完全离线运行，不读取屏幕、键盘、剪贴板或其他应用。",
        )
        .title("关于之之")
        .kind(MessageDialogKind::Info)
        .show(|_| {});
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    save_position_before_exit(&app);
    app.exit(0);
}

fn save_position_before_exit(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        if let Ok(path) = config_path(app) {
            if let Ok(mut stored) = settings::load(&path) {
                if let (Ok(geometry), Ok(monitor)) =
                    (window_geometry(&window), monitor_for_window(&window))
                {
                    stored.record_position(geometry.x, geometry.y, monitor.name().cloned());
                    let _ = settings::save(&path, &stored);
                }
            }
        }
    }
}

fn emit_tray_action(app: &AppHandle, action: &str) {
    let _ = app.emit("tray-action", action);
}

fn create_command_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let toggle_pause = MenuItem::with_id(app, "toggle-pause", "暂停/继续走动", true, None::<&str>)?;
    let size_small = MenuItem::with_id(app, "size-small", "小尺寸（80%）", true, None::<&str>)?;
    let size_normal =
        MenuItem::with_id(app, "size-normal", "标准尺寸（100%）", true, None::<&str>)?;
    let size_large = MenuItem::with_id(app, "size-large", "大尺寸（125%）", true, None::<&str>)?;
    let toggle_autostart =
        MenuItem::with_id(app, "toggle-autostart", "切换开机启动", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "重置到右下角", true, None::<&str>)?;
    let about = MenuItem::with_id(app, "about", "关于之之", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator_one = PredefinedMenuItem::separator(app)?;
    let separator_two = PredefinedMenuItem::separator(app)?;
    let separator_three = PredefinedMenuItem::separator(app)?;
    Menu::with_items(
        app,
        &[
            &toggle_pause,
            &separator_one,
            &size_small,
            &size_normal,
            &size_large,
            &separator_two,
            &toggle_autostart,
            &reset,
            &about,
            &separator_three,
            &quit,
        ],
    )
}

#[tauri::command]
fn show_context_menu(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let menu = create_command_menu(&app).map_err(|error| format!("无法创建右键菜单：{error}"))?;
    window
        .popup_menu(&menu)
        .map_err(|error| format!("无法显示右键菜单：{error}"))
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = create_command_menu(app)?;

    let mut tray = TrayIconBuilder::with_id("zhizhi-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("之之桌面宠物")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                save_position_before_exit(app);
                app.exit(0);
            }
            action => emit_tray_action(app, action),
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window(WINDOW_LABEL) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn prepare_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "找不到之之的主窗口".to_string())?;
    // WebView2 can keep an opaque surface even when the Tauri window is marked
    // transparent. Clearing both layers at startup makes only the alpha-shaped
    // sprite visible on Windows.
    window
        .set_background_color(Some(Color(0, 0, 0, 0)))
        .map_err(|error| format!("无法清除之之的窗口背景：{error}"))?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|error| format!("无法启用鼠标互动：{error}"))?;
    let stored = settings::load(&config_path(app)?)?;
    window
        .set_size(Size::Logical(tauri::LogicalSize::new(
            DEFAULT_WIDTH * stored.size_scale,
            DEFAULT_HEIGHT * stored.size_scale,
        )))
        .map_err(|error| format!("无法恢复之之的大小：{error}"))?;
    restore_window(&window, &stored)?;
    window
        .show()
        .map_err(|error| format!("无法显示之之：{error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
                let _ = window.show();
                let _ = window.set_focus();
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let _ = bottom_right(&window, &monitor);
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            create_tray(app.handle())?;
            if let Err(error) = prepare_window(app.handle()) {
                let path = config_path(app.handle()).ok();
                if let Some(path) = path {
                    let backup = path.with_extension("startup-error.json");
                    let _ = fs::copy(path, backup);
                }
                app.dialog()
                    .message(error)
                    .title("之之无法启动")
                    .kind(MessageDialogKind::Error)
                    .show(|_| {});
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            move_step,
            start_pet_drag,
            finish_dragging,
            show_context_menu,
            resize_pet,
            set_autostart_enabled,
            reset_position,
            show_about,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("之之桌面宠物运行失败");
}
