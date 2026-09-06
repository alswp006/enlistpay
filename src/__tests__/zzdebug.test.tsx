import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

function Probe() {
  const loc = useLocation();
  return <div>{JSON.stringify(loc.state)}</div>;
}

describe("debug", () => {
  it("state passes through", () => {
    const entry = { pathname: "/savings/result", state: { a: 1 } };
    const { container } = render(
      React.createElement(MemoryRouter, { initialEntries: [entry] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/savings/result", element: React.createElement(Probe) })
        )
      )
    );
    console.log(container.innerHTML);
    expect(container.textContent).toContain("1");
  });
});
