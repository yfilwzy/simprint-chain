use std::{collections::HashSet, path::PathBuf};

#[cfg(target_os = "windows")]
pub mod finder {
    use super::*;

    /// 杀死指定进程
    pub fn kill_process(pid: u32) -> Result<(), String> {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};

        unsafe {
            let process_handle =
                OpenProcess(PROCESS_TERMINATE, false, pid).map_err(|e| e.to_string())?;

            TerminateProcess(process_handle, 0).map_err(|e| e.to_string())?;
            CloseHandle(process_handle).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    /// 查找指定进程的 PID 和路径
    fn find_process_sysinfo(process_pattern: &Vec<&str>) -> HashSet<(u32, Option<PathBuf>)> {
        use sysinfo::System;

        let mut sys = System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        sys.processes()
            .iter()
            .filter(|(_, process)| {
                let name = process.name().to_string_lossy().to_string().to_lowercase();
                process_pattern.iter().any(|v| {
                    let process_pattern_lower = v.to_ascii_lowercase();
                    name.contains(&process_pattern_lower)
                })
            })
            .map(|(pid, process)| {
                let process_path = process.exe().map(|v| v.to_path_buf());

                (pid.as_u32(), process_path)
            })
            .collect::<HashSet<(u32, Option<PathBuf>)>>()
    }

    // 获取进程路径
    fn get_process_path_by_pid(pid: u32) -> Option<PathBuf> {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use windows::Win32::Foundation::{CloseHandle, GetLastError, HMODULE, MAX_PATH};
        use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;
        use windows::Win32::System::Threading::{
            OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
        };

        unsafe {
            // 以查询信息和读取内存的权限打开进程
            let process_handle = if let Ok(process_handle) =
                OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
            {
                process_handle
            } else {
                log::debug!("无法打开进程 (PID: {}): {:?}", pid, GetLastError());
                return None;
            };

            if process_handle.is_invalid() {
                log::debug!("无法打开进程 (PID: {}): {:?}", pid, GetLastError());
                return None;
            }

            // 创建一个缓冲区来接收路径
            let mut path_buffer: Vec<u16> = vec![0; MAX_PATH as usize];
            let path_len = GetModuleFileNameExW(
                Some(process_handle),
                Some(HMODULE::default()),
                &mut path_buffer,
            );

            // 关闭进程句柄
            let _ = CloseHandle(process_handle); // 忽略关闭结果

            if path_len == 0 {
                log::debug!("无法获取进程路径 (PID: {}): {:?}", pid, GetLastError());
                return None;
            }

            // 调整缓冲区大小为实际长度
            path_buffer.truncate(path_len as usize);

            // 将 UTF-16 缓冲区转换为 OsString，然后是 PathBuf
            Some(PathBuf::from(OsString::from_wide(&path_buffer)))
        }
    }

    /// 查找进程， 返回进程的 PID 和路径
    pub fn find_process(process_pattern: &Vec<&str>) -> HashSet<(u32, Option<PathBuf>)> {
        let processes = find_process_sysinfo(process_pattern);
        let processes = processes
            .iter()
            .map(|(pid, process_path_buf)| {
                let process_path_buf =
                    process_path_buf.clone().or_else(|| get_process_path_by_pid(*pid));
                (*pid, process_path_buf)
            })
            .collect::<HashSet<(u32, Option<PathBuf>)>>();

        processes
    }

    /// 测试杀手指定名称的进程
    #[test]
    fn test_kill_process() {
        let process_patterns = vec!["brave"];
        let processes = find_process(&process_patterns);
        for (pid, _) in processes {
            let _ = kill_process(pid);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub mod finder {
    use super::*;
    use sysinfo::{Pid, System};

    pub fn find_process(process_pattern: &Vec<&str>) -> HashSet<(u32, Option<PathBuf>)> {
        let mut sys = System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        sys.processes()
            .iter()
            .filter(|(_, process)| {
                let name = process.name().to_string_lossy().to_string().to_lowercase();
                process_pattern.iter().any(|v| {
                    let process_pattern_lower = v.to_ascii_lowercase();
                    name.contains(&process_pattern_lower)
                })
            })
            .map(|(pid, process)| {
                let process_path = process.exe().map(|v| v.to_path_buf());

                (pid.as_u32(), process_path)
            })
            .collect::<HashSet<(u32, Option<PathBuf>)>>()
    }

    /// 杀死指定进程
    pub fn kill_process(pid: u32) -> Result<(), String> {
        let sys = System::new();

        if let Some(process) = sys.process(Pid::from_u32(pid)) {
            process.kill();
            Ok(())
        } else {
            Err(format!("进程不存在: {}", pid))
        }
    }
}

#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return finder::kill_process(pid);
    #[cfg(not(target_os = "windows"))]
    return finder::kill_process(pid);
}
