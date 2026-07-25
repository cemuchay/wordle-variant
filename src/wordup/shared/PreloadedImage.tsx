import { useState, type ImgHTMLAttributes } from "react";

export const PreloadedImage = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { style, onLoad, onError, ...rest } = props;

  if (hasError) return null;

  return (
    <img
      style={{
        ...style,
        transition: "opacity 80ms ease-in",
        opacity: loaded ? 1 : 0,
      }}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
};
