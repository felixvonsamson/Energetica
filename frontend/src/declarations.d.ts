declare module "*.svg" {
    const src: string;
    export default src;
}

declare module "*.mdx" {
    const MDXComponent: () => JSX.Element;
    export default MDXComponent;
}
