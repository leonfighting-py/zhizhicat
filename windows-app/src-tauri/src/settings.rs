use std::{fs, io::ErrorKind, path::Path};

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Left,
    Right,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PetSettings {
    pub version: u8,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub monitor_name: Option<String>,
    pub direction: Direction,
    pub paused: bool,
    pub size_scale: f64,
    pub autostart: bool,
}

impl Default for PetSettings {
    fn default() -> Self {
        Self {
            version: 1,
            x: None,
            y: None,
            monitor_name: None,
            direction: Direction::Right,
            paused: false,
            size_scale: 1.0,
            autostart: false,
        }
    }
}

impl PetSettings {
    pub fn normalize(mut self) -> Self {
        self.version = 1;
        if ![0.8, 1.0, 1.25]
            .iter()
            .any(|allowed| (self.size_scale - allowed).abs() < f64::EPSILON)
        {
            self.size_scale = 1.0;
        }
        self
    }

    pub fn record_position(&mut self, x: i32, y: i32, monitor_name: Option<String>) {
        self.x = Some(x);
        self.y = Some(y);
        self.monitor_name = monitor_name;
    }
}

pub fn load(path: &Path) -> Result<PetSettings, String> {
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(PetSettings::default()),
        Err(error) => return Err(format!("无法读取设置：{error}")),
    };

    match serde_json::from_str::<PetSettings>(&contents) {
        Ok(settings) => Ok(settings.normalize()),
        Err(error) => {
            let backup_path = path.with_extension("corrupt.json");
            let _ = fs::rename(path, backup_path);
            eprintln!("之之设置文件损坏，已恢复默认值：{error}");
            Ok(PetSettings::default())
        }
    }
}

pub fn save(path: &Path, settings: &PetSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建设置目录：{error}"))?;
    }
    let contents = serde_json::to_string_pretty(&settings.clone().normalize())
        .map_err(|error| format!("无法序列化设置：{error}"))?;
    fs::write(path, contents).map_err(|error| format!("无法保存设置：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_are_safe_and_local() {
        assert_eq!(
            PetSettings::default(),
            PetSettings {
                version: 1,
                x: None,
                y: None,
                monitor_name: None,
                direction: Direction::Right,
                paused: false,
                size_scale: 1.0,
                autostart: false,
            }
        );
    }

    #[test]
    fn invalid_scales_are_normalized() {
        let settings = PetSettings {
            size_scale: 1.1,
            ..PetSettings::default()
        };
        assert_eq!(settings.normalize().size_scale, 1.0);
    }

    #[test]
    fn corrupt_files_are_backed_up_and_recovered() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("settings.json");
        fs::write(&path, "not-json").expect("write corrupt settings");

        assert_eq!(
            load(&path).expect("recover settings"),
            PetSettings::default()
        );
        assert!(directory.path().join("settings.corrupt.json").exists());
    }

    #[test]
    fn settings_round_trip_as_versioned_json() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("settings.json");
        let expected = PetSettings {
            x: Some(-40),
            y: Some(720),
            monitor_name: Some("DISPLAY2".into()),
            direction: Direction::Left,
            paused: true,
            size_scale: 1.25,
            autostart: true,
            ..PetSettings::default()
        };

        save(&path, &expected).expect("save settings");
        assert_eq!(load(&path).expect("load settings"), expected);

        let updated = PetSettings {
            paused: false,
            direction: Direction::Right,
            ..expected
        };
        save(&path, &updated).expect("overwrite settings");
        assert_eq!(load(&path).expect("reload settings"), updated);
    }

    #[test]
    fn records_the_latest_runtime_position_before_exit() {
        let mut settings = PetSettings::default();
        settings.record_position(-620, 728, Some("DISPLAY2".into()));

        assert_eq!(settings.x, Some(-620));
        assert_eq!(settings.y, Some(728));
        assert_eq!(settings.monitor_name.as_deref(), Some("DISPLAY2"));
    }
}
