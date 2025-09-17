module.exports = [
"[project]/udaman/node_modules/next/dist/pages/_app.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return App;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/udaman/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [ssr] (ecmascript)");
const _jsxruntime = __turbopack_context__.r("[externals]/react/jsx-runtime [external] (react/jsx-runtime, cjs)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[externals]/react [external] (react, cjs)"));
const _utils = __turbopack_context__.r("[project]/udaman/node_modules/next/dist/shared/lib/utils.js [ssr] (ecmascript)");
/**
 * `App` component is used for initialize of pages. It allows for overwriting and full control of the `page` initialization.
 * This allows for keeping state between navigation, custom error handling, injecting additional data.
 */ async function appGetInitialProps(param) {
    let { Component, ctx } = param;
    const pageProps = await (0, _utils.loadGetInitialProps)(Component, ctx);
    return {
        pageProps
    };
}
class App extends _react.default.Component {
    render() {
        const { Component, pageProps } = this.props;
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            ...pageProps
        });
    }
}
App.origGetInitialProps = appGetInitialProps;
App.getInitialProps = appGetInitialProps;
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=_app.js.map
}),
"[project]/udaman/node_modules/next/app.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/udaman/node_modules/next/dist/pages/_app.js [ssr] (ecmascript)");
}),
];

//# sourceMappingURL=66d3c_next_ac8ce2ee._.js.map