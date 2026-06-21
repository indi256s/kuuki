import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type CardTitleProps = React.ComponentPropsWithoutRef<"h3"> & {
  headingLevel?: HeadingLevel
}

function CardTitle({ className, headingLevel = 3, ...props }: CardTitleProps) {
  const sharedProps = {
    "data-slot": "card-title",
    className: cn("leading-none font-semibold", className),
    ...props,
  }

  switch (headingLevel) {
    case 1:
      return <h1 {...sharedProps} />
    case 2:
      return <h2 {...sharedProps} />
    case 3:
      return <h3 {...sharedProps} />
    case 4:
      return <h4 {...sharedProps} />
    case 5:
      return <h5 {...sharedProps} />
    case 6:
      return <h6 {...sharedProps} />
    default: {
      const _exhaustive: never = headingLevel
      return _exhaustive
    }
  }
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
