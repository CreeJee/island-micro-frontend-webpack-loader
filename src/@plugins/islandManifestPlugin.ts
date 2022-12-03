import webpack, { WebpackPluginInstance } from "webpack";
import { IslandManifestContent } from "../@types";
import { defaultOptions } from "../lib/defaultOptions";

const { RawSource } = webpack.sources;
export class IslandManifestPlugin implements WebpackPluginInstance {
    options: IslandManifestContent;
    constructor(config: IslandManifestContent) {
        this.options = Object.assign(config, defaultOptions)
    }
    createManifest(compilation: webpack.Compilation) {
        compilation.emitAsset(
            'island-manifest.json',
            new RawSource(JSON.stringify(this.options))
        )
    }

    apply(compiler: webpack.Compiler) {
        compiler.hooks.emit.tapPromise('CreateIslandManifestPlugin', async compilation => {
            this.createManifest(compilation);
        });
    }
}