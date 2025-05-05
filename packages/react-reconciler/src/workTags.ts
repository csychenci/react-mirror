export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment;

export const FunctionComponent = 0; // 函数组件
export const HostRoot = 3; // ReactDom.render(<App/>) 的根节点对应的 Fiber 节点类型
export const HostComponent = 5; // <div> 对应的 Fiber 节点类型
export const HostText = 6; // <div>123</div> --> 123 对应的 Fiber 节点类型
export const Fragment = 7; // 碎片