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
  envId: "cangwu-protect-union-d7a350be12a",
  publishableKey: "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNjNjMzNWRlLTQ5MjItNDIzOS1hYzMyLTQ0Y2ZhNTRmM2VkMyJ9.eyJpc3MiOiJodHRwczovL2Nhbmd3dS1wcm90ZWN0LXVuaW9uLWQ3YTM1MGJlMTJhLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsImV4cCI6NDA5NTk5NDMzNiwiaWF0IjoxNzkyMzExMTM2LCJub25jZSI6IkN4WDcybFI3UnFlMHVBOEFfbjdob2ciLCJhdF9oYXNoIjoiQ3hYNzJsUjdScWUwdUE4QV9uN2hvZyIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.a6zFOHTuD2v8BoccWBdj7XjKAlsv3IFvH6L1ybGLK5_EhU60BSCcatu9aMWL-DRi0PLxSw0zU3C15rukybgV3L9-SWBP-tvqcfiEl-FlgZYSy3orYwGBTSOVA8WW7ciMlyw400sDsk1oJoSBPUPVmeM3Vw8XJx-YBxn9-7NprHj3WNRQFbg30Uae1Sr_eHyOANUrE6H3UR78uJhTSefKAdpm-iBMbUkbk0vW0vDUzaq_yBNQE-05l4uDDKvvPwPn9L2LlkQx5EgThF9NnmMPajXTJcALW3To4LaF_z7UX3zk4f4vn-YXVoA6VPEL6Ehtn68hnPGoK7HNi8an1lJxKA",
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