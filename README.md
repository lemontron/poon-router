🚨 **HEYO!** This code is NO hack job; It's a well-thought-out router with a fluent API that is a
breeze to work with and is intended to become the de-facto standard for all React websites.

## npm install poon-router

This is the most golfed router ever made, and it's no slouch! Poon Router is used across all my companies (one with
multi-million dollar revenue, another with over >1M in seed funding). Poon Router's goal is to be opinionated,
thorough, and handy enough to be the #1 React Router.

## Example

React app with a Home Page route, demonstrating the savage focus of Poon Router.

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Stack, defineRoute } from 'poon-router';

defineRoute('HomePage', '/', () => (
  <div>Home Page</div>
));

createRoot(document.getElementById('root')).render(<Stack/>);
```

Aside from simplicity, Poon Router has a fuller feature set
than [React Router](https://www.npmjs.com/package/react-router) (55 KB) which suffers from a lack of focus, which is why
this router exists!

1. No need to use `<Link/>`. Just use plain `<a>`tags
2. Swap `useState()` for `screen.useParam()` or `screen.useQueryParam()` to use a browser history-backed global state
3. Can disable navigation with `useUnsavedChanges()`
4. Minimal re-renders and maximum micro-optimization

# Documentation

Let's jump in to documentation by going over the most important function first.

## Route Definition

```javascript
import { defineRoute } from 'poon-router';
```

Some React routers have routes defined in `<Route/>` tags, but in Poon Router, routes are defined at the root level of
the code. You can put a bunch of these next to each other to define all the routes. You can put these at the root level,
even in the same file as `createRoot`. Poon Router will prioritize higher routes first when matching.

```javascript
defineRoute(name, path, component, type);
```

| Name      | Type                   | Description                                                                                                                             |
|-----------|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| name      | String *(Required)*    | A unique name for the route. Can be passed as the first argument to `navigation.go()`                                                   |
| path      | String *(Required)*    | A pattern such as `/blog`. Navigating to a URL that looks like this pattern will cause the route to become active.                      |
| component | Component *(Required)* | A component to render.                                                                                                                  |
| type      | String *(Optional)*    | A string you want to group fragments of stacks by, you can pass this as `filter` to a `<Stack/>` to make the stack filter by this type. |

You can re-use concepts from other routers based on [path-to-regexp](https://www.npmjs.com/package/path-to-regexp) (eg:
React Router, React Navigation and FlowRouter). Although path-to-regexp is not used, the following paths are all still
valid when brought forth to Poon Router:

- `"/blog/:postId"`
- `"/search/:term?"`
- `"*"`

## React Component: `<Stack/>`

```javascript
import { Stack } from 'poon-router';

const App = () => (
    <Stack filter="demo" mode="stack"/>
);
```

By default, this will simply render a div with contents of the routes in the browser history stack with no types
specified. You can specify a filter to only render certain routes. You might think about this like an "Outlet" from
other routers.

Stacks have two presentation modes:

- `screen` is your basic bog standard router, it will render only one screen at a time. This is what you typically think
  of in a router.
- `stack` (default) on the other hand is more like a mobile app, where you can navigate to a new screen, and the old
  screen will stay in the DOM. This is useful for building full blown apps with animations.

When you use Stack, the stack contents will just append to the bottom of the current content, which is because we expect
some sort of framework like Poon-UI.

## Navigation

``` javascript
import { navigation } from 'poon-router';
```

You can use `navigation` to navigate programmatically. There are multiple functions to facilitate navigation as follows:

### go

``` javascript
navigation.go(target, params, queryParams, opts)
```

| Argument | Type                 | Description                                                                                                                                                                                                                         |
|----------|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `target` | Boolean *(Optional)* | A path or a route name to navigate to. If `target` starts with a slash, it will immediately be navigated to and `params` and `queryParams` are ignored. If target is a `routeName`, a path will be created using all the arguments. |
| `opts`   | Object *(Optional)*  | Navigation options, which are `replaceState` (defaults to false) and `scrollToTop` (defaults to true).                                                                                                                              |

- `{replaceState: true}` will replace the state, instead of adding to the state history.
- `{scrollToTop: false}` will maintain the scroll position across navigations.

### setParams

``` javascript
navigation.setParams(params, opts)
```

Short hand for `navigation.go`, only changes the params *(Object)*.

### setQueryParams

``` javascript
navigation.setQueryParams(params, opts)
```

Short hand for `navigation.go`, only changes the query params *(Object)*.

## Screen Props

Each screen in the stack will receive the `screen`, `isVisible`, and `animateIn` props.

``` javascript
const UserProfile = ({screen, isVisible, animateIn}) => {
  // Can use query params here with screen.useQueryParams()!
  return <div/>;
};
```

- `screen.useParam(key, defaultValue)` Returns a param from the URL using the route definition
- `screen.useQueryParam(key, defaultValue)`  Returns a query param from the URL
- `screen.useRouteName()` Returns the name *(String)* of the currently presented route.
- `screen.usePath()` Returns the path *(String)* of the currently presented route.

## Create Link

``` javascript
import { createLink } from 'poon-router';
```

Returns a URL that can be navigated to. This can be useful to create a dynamic `<a>` tag, or to dynamically go to
different routes. `params` and `queryParams` are encoded within the string.

| Argument      | Type                | Description                                                     |
|---------------|---------------------|-----------------------------------------------------------------|
| `routeName`   | String *(Required)* | Must match a route name from a `defineRoute()`.                 |
| `params`      | Object *(Optional)* | Params to encode into the path corresponding to the `routeName` |
| `queryParams` | Object *(Optional)* | Params to encode into the query string                          |

## Prevent Navigation

``` javascript
import { useUnsavedChanges } from 'poon-router';
```

Using this will cause navigating away from the current URL (such as clicking a link or using the back button) to be
ignored. When the stack is empty, the browser's native Save Changes modal will be presented.

| Argument | Type                 | Description                |
|----------|----------------------|----------------------------|
| `active` | Boolean *(Optional)* | Turns the effect on or off |

## Bonus Utils

These handy utils are there if you need them, only because poon router needs them internally.

```javascript
import { 
  createBus, 
  useBus,
  encodeQueryString, 
  encodeSearchString, 
  parsePathParams,
  randomId,
} from 'poon-router/util.js';
```