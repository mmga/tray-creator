declare module "@jscad/stl-serializer" {
  interface SerializeOptions {
    binary?: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function serialize(options: SerializeOptions, ...geometries: any[]): ArrayBuffer[];

  export default { serialize };
}
