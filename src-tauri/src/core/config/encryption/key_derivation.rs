//! 密钥派生模块
//!
//! 通过复杂算法派生固定的加密密钥，避免密钥以明文形式出现在代码中。
//! 此模块在编译时（build.rs）和运行时都会被使用，必须返回相同的结果。

use sha2::{Digest, Sha256};

/// 通过复杂算法派生主密钥
///
/// 使用多个分散的种子常量和复杂的计算过程，避免密钥以明文形式出现在二进制中。
/// 注意：此函数在编译时和运行时都会被调用，必须返回相同的结果。
fn derive_master_key() -> [u8; 32] {
    // 第一层：分散的种子常量（伪装成配置参数）
    const SEED_ALPHA: u64 = 0x1A2B3C4D5E6F7A8B;
    const SEED_BETA: u64 = 0xFEDCBA9876543210;
    const SEED_GAMMA: &[u8] = &[
        0x43, 0x6f, 0x6e, 0x66, 0x69, 0x67, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74, 0x69, 0x6f,
        0x6e, 0x53, 0x61, 0x6c, 0x74, 0x32, 0x30, 0x32, 0x34,
    ];
    const SEED_DELTA: u32 = 0x89ABCDEF;
    const SEED_EPSILON: u16 = 0x1234;

    // 第二层：构建初始缓冲区（使用不同的字节序和位运算）
    let mut buffer = Vec::with_capacity(128);
    buffer.extend_from_slice(&SEED_ALPHA.to_le_bytes());
    buffer.extend_from_slice(&SEED_BETA.to_be_bytes());
    buffer.extend_from_slice(SEED_GAMMA);
    buffer.extend_from_slice(&SEED_DELTA.rotate_left(13).to_le_bytes());
    buffer.extend_from_slice(&SEED_EPSILON.wrapping_mul(7).to_be_bytes());

    // 第三层：初始哈希
    let mut hasher = Sha256::new();
    hasher.update(&buffer);
    let mut result = hasher.finalize();

    // 第四层：多轮迭代（1000轮，增加计算复杂度）
    for round in 0..1000 {
        let mut hasher = Sha256::new();
        hasher.update(&result);
        // 每轮混入轮数，确保每轮结果不同
        hasher.update(&(round as u32).to_le_bytes());
        result = hasher.finalize();
    }

    // 第五层：最终混淆（使用固定的应用标识）
    const APP_IDENTIFIER: &[u8] = &[
        0x53, 0x69, 0x6d, 0x50, 0x72, 0x69, 0x6e, 0x74, 0x2d, 0x43, 0x6f, 0x6e, 0x66, 0x69, 0x67,
        0x2d, 0x76, 0x31,
    ];
    let mut hasher = Sha256::new();
    hasher.update(&result);
    hasher.update(APP_IDENTIFIER);
    result = hasher.finalize();

    result.into()
}

/// 密钥派生结果
///
/// 包含用于不同目的的子密钥
pub struct DerivedKeys {
    pub encryption_key: [u8; 32], // 用于实际加密
    pub auth_key: [u8; 32],       // 用于认证/校验
    pub transform_key: [u8; 16],  // 用于数据变换
}

/// 从主密钥派生子密钥
///
/// 使用不同的派生路径，生成多个独立的子密钥
pub fn derive_subkeys() -> DerivedKeys {
    let master = derive_master_key();

    // 派生加密密钥
    let encryption_key = derive_subkey(
        &master,
        &[0x65, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74, 0x69, 0x6f, 0x6e],
        1000,
    );

    // 派生认证密钥
    let auth_key = derive_subkey(
        &master,
        &[
            0x61, 0x75, 0x74, 0x68, 0x65, 0x6e, 0x74, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6f, 0x6e,
        ],
        1500,
    );

    // 派生变换密钥
    let transform_key_full = derive_subkey(
        &master,
        &[0x74, 0x72, 0x61, 0x6e, 0x73, 0x66, 0x6f, 0x72, 0x6d],
        2000,
    );
    let mut transform_key = [0u8; 16];
    transform_key.copy_from_slice(&transform_key_full[..16]);

    DerivedKeys {
        encryption_key,
        auth_key,
        transform_key,
    }
}

/// 子密钥派生函数
///
/// 使用 HKDF 类似的方法从主密钥派生子密钥
fn derive_subkey(master: &[u8; 32], context: &[u8], rounds: usize) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(master);
    hasher.update(context);
    let mut result = hasher.finalize();

    // 多轮迭代
    for i in 0..rounds {
        let mut hasher = Sha256::new();
        hasher.update(&result);
        hasher.update(&(i as u32).to_le_bytes());
        hasher.update(context);
        result = hasher.finalize();
    }

    result.into()
}
