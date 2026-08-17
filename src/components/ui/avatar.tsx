import * as React from "react";
import { cn } from "@/lib/utils";

// No @material/web component covers a generic avatar — this is a plain,
// standard image-with-fallback implementation. Root still walks its children
// once to pull src/alt/fallback out of <AvatarImage>/<AvatarFallback>,
// preserving the existing call-site shape
// (<Avatar><AvatarImage .../><AvatarFallback>...</AvatarFallback></Avatar>).
type AvatarImageProps = { src?: string; alt?: string; className?: string };
type AvatarFallbackProps = { children?: React.ReactNode; className?: string };

function Avatar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  let src: string | undefined;
  let alt: string | undefined;
  let fallback: React.ReactNode;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === AvatarImage) {
      const imgProps = child.props as AvatarImageProps;
      src = imgProps.src;
      alt = imgProps.alt;
    } else if (child.type === AvatarFallback) {
      fallback = (child.props as AvatarFallbackProps).children;
    }
  });

  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = !!src && !imgFailed;

  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="aspect-square size-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-xs font-medium">{fallback}</span>
      )}
    </div>
  );
}

// Not rendered directly — Avatar reads its props above. Exists so call
// sites keep using the familiar <AvatarImage src=.../> shape unchanged.
function AvatarImage(_props: AvatarImageProps) {
  return null;
}

function AvatarFallback(_props: AvatarFallbackProps) {
  return null;
}

export { Avatar, AvatarImage, AvatarFallback };
