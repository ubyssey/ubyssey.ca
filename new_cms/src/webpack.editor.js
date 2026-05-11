const path = require("path")

module.exports = {
    entry: path.resolve(__dirname, "editor.js"),
    mode: "development",

    output: {
        path: path.resolve(__dirname, "../static/new_cms"),
        filename: "editor_bundle.js",
    },

    resolve: {
        modules: [
            path.resolve(__dirname, "../../ubyssey/static_src/node_modules"),
            "node_modules"
        ]
    },

    module: {
        rules: [
        {
            test: /\.css$/i,
            use: ["style-loader", "css-loader"]
        }
        ]
    },
}