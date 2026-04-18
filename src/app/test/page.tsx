export default function TestPage() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">测试页面</h1>
      <p>如果你能看到这个页面，说明页面渲染是正常的。</p>
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h2 className="font-bold">智能体列表：</h2>
        <ul>
          <li>Agent A - 核心战略决策者</li>
          <li>Agent B - 技术落地人</li>
          <li>Agent C - 运营数据反馈人</li>
          <li>Agent D - 内容数据反馈人</li>
          <li>Agent insurance-c - C-保险运营</li>
          <li>Agent insurance-d - D-保险内容</li>
        </ul>
      </div>
    </div>
  );
}
