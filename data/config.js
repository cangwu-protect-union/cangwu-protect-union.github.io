/* ============================================================
   config.js —— 云数据库配置（腾讯云 CloudBase · PostgreSQL）
   ------------------------------------------------------------
   留空时：图鉴用浏览器本地存储，功能完整，换设备看不到新增条目。
   填好后：条目存到腾讯云，所有设备都能看到。

   要填两个值（见项目里的「云数据库配置说明.md」）：
     1. envId            —— 环境 ID，形如 cangwu-protect-union-d7a350be12a
     2. publishableKey   —— 云开发平台 → 身份认证 → ApiKey 管理 里的
                            「Publishable Key」（这个可以公开，专给浏览器用）
   ============================================================ */

window.GUI_CLOUDBASE = {
  envId: "",           // 例："cangwu-protect-union-d7a350be12a"
  publishableKey: "",  // 例："eyJhbGciOiJIUzI1NiIs..."
  table: "gui_entries"
};

/* ------------------------------------------------------------
   旧的 Supabase 配置（已废弃）
   2026-10-18：*.supabase.co 在中国大陆不可达（DNS 污染 + IP 阻断），
   所以改用腾讯云 CloudBase。这段留着以防将来网络条件变化。
   ------------------------------------------------------------ */
window.GUI_SUPABASE = {
  url: "",
  anonKey: "",
  table: "gui_entries"
};