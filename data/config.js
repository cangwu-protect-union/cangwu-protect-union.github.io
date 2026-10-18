/* ============================================================
   config.js —— 云数据库（Supabase）配置
   ------------------------------------------------------------
   这里是空的，所以图鉴现在用「浏览器本地存储」运行，功能完整。
   填好下面两个值之后，新增的条目就会真正存到云端，换设备也能看到。

   怎么填（见项目里的「云数据库配置说明.md」）：
     1. 注册 https://supabase.com ，新建一个免费项目
     2. 项目里 Settings -> API，复制 Project URL 和 anon public key
     3. 把两个值分别粘到下面，保存、提交、推送，就生效了
   ============================================================ */

window.GUI_SUPABASE = {
  url: "",        // 例："https://abcdefghijkl.supabase.co"
  anonKey: "",    // 例："eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  table: "gui_entries"
};