import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatch';
import currentBatchConfig from './src/currentBatchConfig';
import { jsx, jsxDEV } from './src/jsx';

export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols';

export const useState: Dispatcher['useState'] = (
	initialState
) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] =
	(create, deps) => {
		const dispatcher = resolveDispatcher();
		return dispatcher.useEffect(create, deps);
	};

export const useTransition: Dispatcher['useTransition'] =
	() => {
		const dispatcher = resolveDispatcher();
		return dispatcher.useTransition();
	};

export const useRef: Dispatcher['useRef'] = (
	initialValue
) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useRef(initialValue);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
	{
		currentDispatcher,
		currentBatchConfig
	};

export default {
	version: '0.0.0',
	createElement: jsx,
	createElementDEV: jsxDEV
};
