/* ============================================================
   config.js —— 异常区域档案的站点配置
   ------------------------------------------------------------
   三块内容：
     1. 云数据库连接（与鬼图鉴共用同一个 CloudBase 环境，只是表不同）
     2. 地图底图（天地图官方 WMTS；没有 key 时自动退回高德过渡底图）
     3. 静态兜底文件位置

   注意：envId 与 publishableKey 必须和 guitu/data/config.js 保持一致。
   publishableKey 是「可公开密钥」，设计上就允许放在前端；
   真正拦住写操作的是数据库的行级安全策略 + 组织验证令牌。
   ============================================================ */

window.GUI_CLOUDBASE = {
  envId: "cangwu-protect-union-d7a350be12a",
  publishableKey: "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNjNjMzNWRlLTQ5MjItNDIzOS1hYzMyLTQ0Y2ZhNTRmM2VkMyJ9.eyJpc3MiOiJodHRwczovL2Nhbmd3dS1wcm90ZWN0LXVuaW9uLWQ3YTM1MGJlMTJhLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsImV4cCI6NDA5NTk5NDMzNiwiaWF0IjoxNzkyMzExMTM2LCJub25jZSI6IkN4WDcybFI3UnFlMHVBOEFfbjdob2ciLCJhdF9oYXNoIjoiQ3hYNzJsUjdScWUwdUE4QV9uN2hvZyIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJjYW5nd3UtcHJvdGVjdC11bmlvbi1kN2EzNTBiZTEyYSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.a6zFOHTuD2v8BoccWBdj7XjKAlsv3IFvH6L1ybGLK5_EhU60BSCcatu9aMWL-DRi0PLxSw0zU3C15rukybgV3L9-SWBP-tvqcfiEl-FlgZYSy3orYwGBTSOVA8WW7ciMlyw400sDsk1oJoSBPUPVmeM3Vw8XJx-YBxn9-7NprHj3WNRQFbg30Uae1Sr_eHyOANUrE6H3UR78uJhTSefKAdpm-iBMbUkbk0vW0vDUzaq_yBNQE-05l4uDDKvvPwPn9L2LlkQx5EgThF9NnmMPajXTJcALW3To4LaF_z7UX3zk4f4vn-YXVoA6VPEL6Ehtn68hnPGoK7HNi8an1lJxKA",
  table: "gui_zones"
};

/* 仓库里的静态兜底（云端不可用时用）；云端读取成功时不参与合并 */
window.ZONE_APP = {
  table: "gui_zones",
  entriesFile: "data/zones.json"
};

/* ============================================================
   地图配置
   ------------------------------------------------------------
   provider:
     "tianditu" → 天地图官方 WMTS，需要下面填 key
     "amap"     → 高德非官方瓦片，仅作 key 到手前的过渡底图
                  没有服务承诺，随时可能失效，正式版不要用它

   tiandituKey 填好后把 provider 改成 "tianditu" 即可，代码不用动。
   ============================================================ */
window.ZONE_MAP = {
  provider: "amap",
  tiandituKey: "",

  /* 初始视野：江浙一带，坐标 [纬度, 经度]（WGS-84 / CGCS2000） */
  center: [30.9, 120.2],
  zoom: 6,

  amap: {
    /* 只需换 1-4 四个子域，协议必须 https，否则 https 页面会触发混合内容拦截 */
    url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    subdomains: ["1", "2", "3", "4"]
  },

  tianditu: {
    /* 天地图把「底图」与「注记」分成两个图层，必须叠起来才是完整地图 */
    vec: "https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
         "&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles" +
         "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}",
    cva: "https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
         "&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles" +
         "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}",
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"]
  }
};
