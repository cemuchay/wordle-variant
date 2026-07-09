import { useState, type ImgHTMLAttributes } from "react";

export const PreloadedImage = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const [loaded, setLoaded] = useState(false);
  const { style, onLoad, ...rest } = props;
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
      {...rest}
    />
  );
};
