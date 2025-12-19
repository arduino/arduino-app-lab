#### Separating Components
This package contains a directory "./essential" for components that could be considered distinctly simplistic,
or presentational, or even just highly agnostic.

It's important to emphasize that this is not a strict implementation of the well-known container/presentation components pattern.

As explained well in the following article https://formidable.com/blog/2021/react-components/, as of writing this README much
of the "React community" has moved away from enforcing this kind of strict segregation.

Here we have two categories of components, "essential" and "everything-else", having the two encourages us to think about
at what point in the component tree we should have our logic and state. "What belongs where?" is at the discretion of the developer.

Generally, if a component could be used in any application with little friction we can consider it "essential."

#### Injectable Logic As Props

Some of the more complex components in this library have “logic props” - props suffixed with `Logic` like `<component>Logic`. These props are functions with distinct types, to be executed during component rendering, at the top level.

The injection of bespoke logic via "logic props" should:
- Encourage agnostic components, with bespoke logic decoupled and bound to components in consumer apps - in this codebase in the `core-ui` layer;
- Group component dependencies (which are returned from invoked `logic` props) for clearer differentiation across what's "passed down the app hierarchy", and “cleaner prop drilling” in general;
- Enable simpler unit testing: in applications injected logic is isolated from components, as a result “reacty boilerplate” is reduced. In `ui-components` mocking component dependencies is less restricted;
- Permit consumer customization of logic that executes specifically in the “render flow” of a target component;

##### NOTE
Most of the above can of course be achieved with other approaches, some of which are more idiomatic for react apps.
With the adopted pattern we aim for a more ergonomic codebase and smoother developer experience.

It’s important to highlight that what's passed via `<component>Logic` props should not change (as an entity, not an instance) at runtime, it being a prop does not imply it should do so.  As logic props could contain hooks, “switching them out” can be a violation of the “rules of react hooks”, and result in unpredictable bugs.

#### React Component Structure

We should try to order "render flow" code to make components as readable as possible. The following structure within React Functional Components is proposed* (the ordering is based on likelihood of dependence):

1. `useContext` and prop destructuring;
2. `useState` & `useRef` (or similar);
3. Custom & 3rd Party hooks (e.g. `useQueries | useMediaQuery`);
4. Handlers (e.g. `onClick | onAction | onSelectItem`);
5. `useEffect` & "Component Lifecycle" specific hooks (e.g. `useLayoutEffect | useUnmount`);
6. Variables for JSX;
7. `return <JSX>`;

*there are times this ordering will need changing to ensure "declaration before use", hence the above should be considered a guide and if required, a basis for subsequent sorting of logic by dependence.

#### Storybook references

https://github.com/storybookjs/storybook/issues/17831