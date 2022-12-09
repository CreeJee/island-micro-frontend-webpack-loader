import webpack, { RuleSetRule } from 'webpack';
import { ModuleFederationConfig, IslandPluginOptions, WebpackConfig, PageModuleStructure } from './@types';
import { addAfterLoader, addBeforeLoader, getLoader, loaderByName, removeLoaders } from "./lib/injectLoader"
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import path from "path"
import { defaultOptions } from './lib/defaultOptions';
import { IslandManifestPlugin } from './@plugins/islandManifestPlugin';
//@ts-ignore
import { parseOptions as parseOptionsOriginal } from "webpack/lib/container/options"

type ContainerOptionsFormat<T> =
    | Record<string, string | string[] | T>
    | (string | Record<string, string | string[] | T>)[];

const parseOptions = <T, R>(
    options: ContainerOptionsFormat<T>,
    normalizeSimple: (a: string | string[], b: string) => R,
    normalizeOptions: (t: T, a: string) => R,
): [string, R][] => parseOptionsOriginal(options, normalizeSimple, normalizeOptions);


export const overrideWebpackSetting = (
    webpackConfig: WebpackConfig,
    modulefederationConfig: ModuleFederationConfig,
    config: IslandPluginOptions,
) => {
    const publicPath = webpackConfig.output?.publicPath;
    if (!publicPath) {
        throw new Error("publicPath is must be specified, if publicPath is auto, the main app will be Crashed");
    }

    const parsedExpose = parseOptions(
        modulefederationConfig.exposes ?? {},
        item => ({
            import: Array.isArray(item) ? item : [item],
            name: undefined
        }),
        item => ({
            import: Array.isArray(item.import) ? item.import : [item.import],
            name: item.name || undefined
        })
    );
    const moduleStructureConfig: PageModuleStructure = {
        url: `${publicPath === "auto" ? "/" : publicPath}${modulefederationConfig.filename}`,
        scope: modulefederationConfig.name ?? "",
        modules: parsedExpose.map(([ns]) => ns),
    };
    const mergedConfig = Object.assign(
        Object.create(null),
        defaultOptions,
        moduleStructureConfig,
        config,
    );
    const { useNamedChunkIds, useShadowDom } = mergedConfig
    //override config
    webpackConfig.output = {
        ...webpackConfig.output,
        publicPath: publicPath
    }
    if (useNamedChunkIds) {
        webpackConfig.optimization = {
            ...webpackConfig.optimization,
            chunkIds: webpackConfig.optimization?.chunkIds ?? 'named'
        }
    }

    const moduleFederationContainer = new webpack.container.ModuleFederationPlugin(modulefederationConfig);
    const externalWebpackPlugins = [
        moduleFederationContainer,
        new CssMinimizerPlugin(),
        new IslandManifestPlugin(mergedConfig),
    ];

    // https://github.com/tabatkins/parse-css
    if (useShadowDom) {
        const { isFound, match } = getLoader(webpackConfig, loaderByName('style-loader'));
        const styleLoaderData = {
            loader: "style-loader",
            options: {
                ...(match && typeof match.loader === 'object' ? match.loader : {}),
                injectType: "styleTag",

                styleTagTransform: function (css: string, style: HTMLStyleElement) {



                    //logic
                    var moduleNamespace = process.env.KEY_MODE;
                    var moduleFederatonStyleKey = Symbol.for("@shadow-dom/mount-root");
                    // @ts-ignore
                    var moduleStore = window[moduleFederatonStyleKey] as unknown as Record<string, Node>;
                    var bindStyleTag = function (css: string, style?: HTMLStyleElement) {
                        if (!style) {
                            style = document.createElement("style");
                        }
                        style.innerHTML = css;
                        if (moduleStore && moduleNamespace) {
                            var $mountedDom = moduleStore[moduleNamespace];
                            if (
                                $mountedDom instanceof Node
                            ) {
                                $mountedDom.appendChild(style);
                                return;
                            }
                        }
                        document.head.appendChild(style);
                    }



                    //append fontStyle
                    while (true) {
                        var isFontFace = css.indexOf("@font-face") >= 0;
                        var isCssImport = css.indexOf("@import") >= 0;
                        // font-및 import 기능이 있는지 확인한다
                        if (!(isFontFace || isCssImport)) {
                            break;
                        }
                        var cssContent = "";
                        var cursorStart = null;
                        var cursorEnd = null;
                        if (isFontFace) {
                            var cssNode = document.createElement('style');
                            cursorStart = css.indexOf("@font-face");
                            cursorEnd = css.indexOf("}", cursorStart) + 1;
                            cssNode.innerHTML = cssContent;
                            document.head.appendChild(cssNode);
                        }
                        if (isCssImport) {
                            var linkTag = document.createElement('link');
                            var regex = /(?:(?<=@import\s*(['"]|url\()\s*)((?:\S|\\\1)+)\s*(?:\1|\))\s*\)?\s?(.*?);)/igm
                            var matched = regex.exec(css);
                            if (matched) {

                                cursorStart = matched.index;
                                cursorEnd = cursorStart + matched[0].length;

                                var url = matched[2];
                                var mediaQuery = matched[3];
                                linkTag.rel = 'stylesheet';
                                linkTag.type = 'text/css';
                                if (url) {
                                    linkTag.href = url;
                                }
                                if (mediaQuery) {
                                    linkTag.media = mediaQuery;
                                }
                            }
                        }
                        if (cursorStart !== null && cursorEnd !== null) {
                            cssContent = css.slice(cursorStart, cursorEnd);
                            css = css.slice(0, cursorStart) + css.slice(cursorEnd);
                        }
                    }

                    // append style
                    bindStyleTag(css, style)
                }
            },
        }
        externalWebpackPlugins.push(
            new webpack.EnvironmentPlugin({
                KEY_MODE: modulefederationConfig.name
            })
        );
        if (isFound) {
            match.parent[match.index] = styleLoaderData;
        } else {
            addBeforeLoader(webpackConfig, loaderByName('mini-css-extract-plugin'), styleLoaderData)
            removeLoaders(webpackConfig, loaderByName('mini-css-extract-plugin'));
            const foundIndex = (webpackConfig.plugins ?? []).findIndex(
                (plugin) => plugin.constructor.name === 'MiniCssExtractPlugin',
            );
            webpackConfig.plugins?.splice(foundIndex, 1);
        }
    }
    webpackConfig.plugins = [
        ...(webpackConfig.plugins ?? []),
        ...externalWebpackPlugins
    ]
    webpackConfig.resolveLoader = {
        ...webpackConfig.resolveLoader,
        alias: {
            ...webpackConfig.resolveLoader?.alias,
            '@island-manifest-loader': path.resolve(__dirname, '@loader/manifest-loader.js')
        }
    }
    return webpackConfig;
};
export default overrideWebpackSetting;
