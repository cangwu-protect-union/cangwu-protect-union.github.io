/* ============================================================
   config.js —— 站点配置
   ------------------------------------------------------------
   图鉴数据存在腾讯云 CloudBase（PostgreSQL）+ 仓库里的种子数据。
   云端让新增条目对所有设备立即可见；云端不可用时自动退回本地。
   ============================================================ */

window.GUI_CLOUDBASE = {
  envId: "cangwu-protect-union-d7a350be12a",
  publishableKey: "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNjNjMzNWRlLTQ5MjItNDIzOS1hYzMyLTQ0Y2ZhNTRmM2VkMyJ9.eyJpc3MiOiJodHRwczovL2Nhbmd3dS1wcm90ZWN0LXVuaW9uLWQ3YTM1MGJlMTJhLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsImV4cCI6NDA5NTk5NDMzNiwiaWF0IjoxNzkyMzExMTM2LCJub25jZSI6IkN4WDcybFI3UnFlMHVBOEFfbjdob2ciLCJhdF9oYXNoIjoiQ3hYNzJsUjdScWUwdUE4QV9uN2hvZyIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.a6zFOHTuD2v8BoccWBdj7XjKAlsv3IFvH6L1ybGLK5_EhU60BSCcatu9aMWL-DRi0PLxSw0zU3C15rukybgV3L9-SWBP-tvqcfiEl-FlgZYSy3orYwGBTSOVA8WW7ciMlyw400sDsk1oJoSBPUPVmeM3Vw8XJx-YBxn9-7NprHj3WNRQFbg30Uae1Sr_eHyOANUrE6H3UR78uJhTSefKAdpm-iBMbUkbk0vW0vDUzaq_yBNQE-05l4uDDKvvPwPn9L2LlkQx5EgThF9NnmMPajXTJcALW3To4LaF_z7UX3zk4f4vn-YXVoA6VPEL6Ehtn68hnPGoK7HNi8an1lJxKA",
  table: "gui_entries"
};

/* 备用：仓库里的静态条目文件（保留载入，作为云端故障时的兜底） */
window.GUI_APP = {
  entriesFile: "data/entries.json"
};