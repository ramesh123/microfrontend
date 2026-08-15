import * as React from "react"
import MuiAvatar from "@mui/material/Avatar"

type AvatarImageProps = { src?: string; alt?: string; className?: string }
type AvatarFallbackProps = { children?: React.ReactNode; className?: string }

// Radix splits Avatar into Root/Image/Fallback so the fallback only shows
// if the image fails to load — Root doesn't itself take `src`, its
// AvatarImage child does. MUI's Avatar takes `src` directly on the root and
// falls back to its `children` on load error, so Root here walks its
// children once to find an AvatarImage/AvatarFallback and feeds their
// src/content into a single underlying MuiAvatar, preserving the same
// call-site shape (<Avatar><AvatarImage .../><AvatarFallback>...</AvatarFallback></Avatar>).
function Avatar({ className, children, ...props }: React.ComponentProps<typeof MuiAvatar>) {
  let src: string | undefined
  let alt: string | undefined
  let fallback: React.ReactNode

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === AvatarImage) {
      const imgProps = child.props as AvatarImageProps
      src = imgProps.src
      alt = imgProps.alt
    } else if (child.type === AvatarFallback) {
      fallback = (child.props as AvatarFallbackProps).children
    }
  })

  return (
    <MuiAvatar data-slot="avatar" className={className} src={src} alt={alt} {...props}>
      {fallback}
    </MuiAvatar>
  )
}

// Not rendered directly — Avatar reads its props above. Exists so call
// sites keep using the familiar <AvatarImage src=.../> shape unchanged.
function AvatarImage(_props: AvatarImageProps) {
  return null
}

function AvatarFallback(_props: AvatarFallbackProps) {
  return null
}

export { Avatar, AvatarImage, AvatarFallback }
