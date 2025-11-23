export default function DiagnosticTest() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1 style={{ color: 'green' }}>✅ React正在工作！</h1>
      <p>如果你能看到这个页面，说明：</p>
      <ul>
        <li>✅ Vite服务器正常运行</li>
        <li>✅ React正在渲染</li>
        <li>✅ 路由正常工作</li>
      </ul>
      <p>VITE_TEST_MODE: {import.meta.env.VITE_TEST_MODE || '未设置'}</p>
      <p>VITE_XHS_API_URL: {import.meta.env.VITE_XHS_API_URL || '未设置'}</p>
    </div>
  );
}
