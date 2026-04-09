declare module "@jscad/stl-serializer" {
  interface SerializeOptions {
    binary?: boolean;
  }

  function serialize(
    options: SerializeOptions,
    ...geometries: unknown[]
  ): ArrayBuffer[];
  export { serialize };

  const serializer: {
    serialize: (
      options: SerializeOptions,
      ...geometries: unknown[]
    ) => ArrayBuffer[];
  };

  export default serializer;
}
