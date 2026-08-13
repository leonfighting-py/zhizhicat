use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveResult {
    pub hit_edge: bool,
    pub x: i32,
    pub y: i32,
    pub monitor_name: Option<String>,
}

pub fn bottom_y(work_area: Rect, window_height: u32) -> i32 {
    work_area.y + work_area.height.saturating_sub(window_height) as i32
}

pub fn clamp_x(x: i32, work_area: Rect, window_width: u32) -> i32 {
    let maximum = work_area.x + work_area.width.saturating_sub(window_width) as i32;
    x.clamp(work_area.x, maximum)
}

pub fn clamp_y(y: i32, work_area: Rect, window_height: u32) -> i32 {
    let maximum = bottom_y(work_area, window_height);
    y.clamp(work_area.y, maximum)
}

pub fn move_horizontal(
    window: WindowGeometry,
    work_area: Rect,
    signed_delta: i32,
) -> (WindowGeometry, bool) {
    let requested_x = window.x.saturating_add(signed_delta);
    let x = clamp_x(requested_x, work_area, window.width);
    let hit_edge = x != requested_x;
    (
        WindowGeometry {
            x,
            y: bottom_y(work_area, window.height),
            ..window
        },
        hit_edge,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aligns_the_window_with_the_work_area_bottom() {
        let work_area = Rect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };
        assert_eq!(bottom_y(work_area, 312), 728);
    }

    #[test]
    fn clamps_x_on_monitors_with_negative_origins() {
        let work_area = Rect {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
        };
        assert_eq!(clamp_x(-2_500, work_area, 288), -1920);
        assert_eq!(clamp_x(50, work_area, 288), -288);
        assert_eq!(clamp_x(-900, work_area, 288), -900);
    }

    #[test]
    fn reports_an_edge_when_the_requested_move_would_cross_it() {
        let work_area = Rect {
            x: 100,
            y: 20,
            width: 1_000,
            height: 700,
        };
        let window = WindowGeometry {
            x: 805,
            y: 0,
            width: 288,
            height: 312,
        };
        let (moved, hit_edge) = move_horizontal(window, work_area, 25);

        assert_eq!(moved.x, 812);
        assert_eq!(moved.y, 408);
        assert!(hit_edge);
    }

    #[test]
    fn oversized_windows_fall_back_to_the_work_area_origin() {
        let work_area = Rect {
            x: -200,
            y: -50,
            width: 220,
            height: 180,
        };
        assert_eq!(clamp_x(999, work_area, 288), -200);
        assert_eq!(bottom_y(work_area, 312), -50);
    }

    #[test]
    fn clamps_a_paused_position_inside_the_work_area() {
        let work_area = Rect {
            x: 0,
            y: -900,
            width: 1440,
            height: 860,
        };
        assert_eq!(clamp_y(-2_000, work_area, 312), -900);
        assert_eq!(clamp_y(500, work_area, 312), -352);
        assert_eq!(clamp_y(-600, work_area, 312), -600);
    }
}
