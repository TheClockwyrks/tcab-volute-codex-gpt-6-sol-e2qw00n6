// One-time source artwork generator. Production builds use the committed PNGs.
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
const root = "public/assets";
const make = (w, h) => {
  const canvas = createCanvas(w, h);
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  return { canvas, c };
};
const save = (canvas, path) => {
  mkdirSync(`${root}/${path.split("/").slice(0, -1).join("/")}`, {
    recursive: true,
  });
  writeFileSync(`${root}/${path}`, canvas.toBuffer("image/png"));
};
const poly = (c, pts, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...pts[0]);
  for (const p of pts.slice(1)) c.lineTo(...p);
  c.closePath();
  c.fill();
};
const line = (c, pts, color, w = 1) => {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(...pts[0]);
  for (const p of pts.slice(1)) c.lineTo(...p);
  c.stroke();
};
const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};
const circle = (c, x, y, r, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
const colors = [
  ["halide", "#70e3d8", "#c9fff0", "#2f817f"],
  ["sulfur", "#eebc58", "#fff0a7", "#9d612e"],
  ["cobalt", "#709df2", "#b6d8ff", "#3b4f9d"],
  ["garnet", "#e97295", "#ffd0dc", "#922f5b"],
  ["olivine", "#a7d879", "#e5ffac", "#5f8a3f"],
];
for (const [name, base, light, dark] of colors) {
  const { canvas, c } = make(28, 28);
  circle(c, 14, 15, 13, "#060c13");
  poly(
    c,
    [
      [13, 1],
      [21, 3],
      [26, 10],
      [25, 20],
      [18, 27],
      [9, 26],
      [2, 20],
      [1, 10],
      [6, 3],
    ],
    dark,
  );
  poly(
    c,
    [
      [8, 3],
      [17, 2],
      [24, 7],
      [17, 10],
      [13, 6],
    ],
    light,
  );
  poly(
    c,
    [
      [3, 9],
      [12, 6],
      [17, 10],
      [14, 19],
      [5, 21],
      [2, 16],
    ],
    base,
  );
  poly(
    c,
    [
      [17, 10],
      [25, 8],
      [25, 18],
      [18, 25],
      [14, 19],
    ],
    base,
  );
  poly(
    c,
    [
      [7, 21],
      [14, 19],
      [18, 25],
      [10, 25],
    ],
    light,
  );
  line(
    c,
    [
      [6, 7],
      [10, 4],
      [15, 5],
    ],
    "#ffffff",
    1,
  );
  rect(c, 9, 9, 2, 2, light);
  rect(c, 20, 17, 2, 2, light);
  circle(c, 14, 14, 5, "#102029");
  if (name === "halide") {
    poly(
      c,
      [
        [14, 9],
        [18, 14],
        [14, 19],
        [10, 14],
      ],
      light,
    );
    circle(c, 14, 14, 2, dark);
  } else if (name === "sulfur") {
    poly(
      c,
      [
        [10, 10],
        [17, 10],
        [13, 14],
        [18, 14],
        [11, 19],
        [14, 15],
        [10, 15],
      ],
      light,
    );
  } else if (name === "cobalt") {
    rect(c, 10, 11, 2, 7, light);
    rect(c, 13, 9, 2, 9, light);
    rect(c, 16, 12, 2, 6, light);
  } else if (name === "garnet") {
    line(
      c,
      [
        [10, 10],
        [18, 18],
      ],
      light,
      2,
    );
    line(
      c,
      [
        [18, 10],
        [10, 18],
      ],
      light,
      2,
    );
  } else {
    line(
      c,
      [
        [14, 18],
        [14, 11],
      ],
      light,
      2,
    );
    poly(
      c,
      [
        [14, 13],
        [11, 10],
        [9, 10],
        [10, 13],
      ],
      light,
    );
    poly(
      c,
      [
        [14, 12],
        [17, 9],
        [19, 9],
        [18, 12],
      ],
      light,
    );
  }
  save(canvas, `sprites/core-${name}.png`);
}
const marks = ["choke", "backflow", "bore", "sightline"];
for (const name of marks) {
  const { canvas, c } = make(16, 16);
  circle(c, 8, 8, 7, "#09131bcc");
  circle(c, 8, 8, 5, "#f7e8c4");
  circle(c, 8, 8, 4, "#17313b");
  if (name === "choke") {
    rect(c, 4, 7, 8, 2, "#f7e8c4");
    rect(c, 7, 4, 2, 8, "#f7e8c4");
    circle(c, 8, 8, 2, "#17313b");
  }
  if (name === "backflow") {
    poly(
      c,
      [
        [3, 8],
        [9, 3],
        [9, 6],
        [13, 6],
        [13, 10],
        [9, 10],
        [9, 13],
      ],
      "#f7e8c4",
    );
  }
  if (name === "bore") {
    circle(c, 8, 8, 4, "#f7e8c4");
    circle(c, 8, 8, 2, "#17313b");
    rect(c, 7, 1, 2, 3, "#f7e8c4");
    rect(c, 7, 12, 2, 3, "#f7e8c4");
  }
  if (name === "sightline") {
    line(
      c,
      [
        [2, 8],
        [14, 8],
      ],
      "#f7e8c4",
      2,
    );
    line(
      c,
      [
        [8, 2],
        [8, 14],
      ],
      "#f7e8c4",
      2,
    );
    circle(c, 8, 8, 2, "#f7e8c4");
  }
  save(canvas, `sprites/mark-${name}.png`);
}
{
  const { canvas, c } = make(44, 44);
  circle(c, 22, 22, 21, "#070d14");
  circle(c, 22, 22, 19, "#725d47");
  circle(c, 22, 22, 16, "#20333b");
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    circle(c, 22 + 17 * Math.cos(t), 22 + 17 * Math.sin(t), 2, "#b59867");
  }
  circle(c, 22, 22, 12, "#748b8b");
  circle(c, 22, 22, 9, "#10232b");
  rect(c, 18, 3, 8, 4, "#d29f62");
  save(canvas, "sprites/injector-base.png");
}
{
  const { canvas, c } = make(44, 20);
  poly(
    c,
    [
      [2, 5],
      [28, 5],
      [35, 2],
      [43, 3],
      [43, 17],
      [35, 18],
      [28, 15],
      [2, 15],
    ],
    "#0b1219",
  );
  poly(
    c,
    [
      [4, 7],
      [30, 7],
      [35, 5],
      [40, 5],
      [40, 15],
      [35, 15],
      [30, 13],
      [4, 13],
    ],
    "#8d9c97",
  );
  rect(c, 7, 8, 22, 2, "#d9c28b");
  rect(c, 36, 7, 4, 6, "#37464b");
  rect(c, 1, 8, 5, 4, "#435658");
  save(canvas, "sprites/injector-barrel.png");
}
{
  const { canvas, c } = make(64, 64);
  circle(c, 32, 32, 31, "#050a0e");
  circle(c, 32, 32, 28, "#75533d");
  circle(c, 32, 32, 23, "#172930");
  circle(c, 32, 32, 17, "#03080c");
  for (let a = 0; a < 12; a++) {
    const t = (a * Math.PI) / 6;
    poly(
      c,
      [
        [32 + 19 * Math.cos(t - 0.12), 32 + 19 * Math.sin(t - 0.12)],
        [32 + 28 * Math.cos(t), 32 + 28 * Math.sin(t)],
        [32 + 19 * Math.cos(t + 0.12), 32 + 19 * Math.sin(t + 0.12)],
      ],
      "#bd8a5e",
    );
  }
  for (let a = 0; a < 6; a++) {
    const t = (a * Math.PI) / 3;
    circle(c, 32 + 26 * Math.cos(t), 32 + 26 * Math.sin(t), 2, "#e2b979");
  }
  save(canvas, "sprites/intake-maw.png");
}
{
  const { canvas, c } = make(64, 64);
  rect(c, 0, 0, 64, 64, "#26383e");
  for (let y = 0; y < 64; y += 16) {
    rect(c, 0, y, 64, 1, "#33494e");
    rect(c, ((y / 16) % 2) * 16, y + 8, 48, 1, "#1a2c32");
  }
  for (let x = 8; x < 64; x += 16) {
    rect(c, x, 0, 1, 64, "#3b4a49");
    circle(c, x, 8, 1, "#b39365");
  }
  rect(c, 0, 31, 64, 2, "#6c5945");
  save(canvas, "sprites/channel-plate.png");
}
{
  const { canvas, c } = make(24, 24);
  poly(
    c,
    [
      [8, 2],
      [16, 2],
      [21, 7],
      [21, 17],
      [16, 22],
      [8, 22],
      [3, 17],
      [3, 7],
    ],
    "#d2ae72",
  );
  poly(
    c,
    [
      [8, 5],
      [16, 5],
      [18, 8],
      [18, 16],
      [16, 19],
      [8, 19],
      [6, 16],
      [6, 8],
    ],
    "#2d5555",
  );
  rect(c, 10, 8, 4, 8, "#8ef1cf");
  save(canvas, "sprites/hud-cell.png");
}
{
  const { canvas, c } = make(24, 24);
  circle(c, 12, 12, 11, "#a3845b");
  circle(c, 12, 12, 8, "#182c33");
  for (let i = 0; i < 5; i++) {
    let t = ((i * 35 + 200) * Math.PI) / 180;
    rect(c, 11 + 6 * Math.cos(t), 11 + 6 * Math.sin(t), 2, 2, "#dec18a");
  }
  line(
    c,
    [
      [12, 12],
      [17, 7],
    ],
    "#f39180",
    2,
  );
  circle(c, 12, 12, 2, "#f2c986");
  save(canvas, "sprites/hud-pressure.png");
}
for (let i = 0; i < 4; i++) {
  const { canvas, c } = make(44, 20);
  const k = [0, 3, 5, 2][i];
  poly(
    c,
    [
      [1, 5],
      [26 - k, 5],
      [32 - k, 2],
      [40 - k, 3],
      [40 - k, 17],
      [32 - k, 18],
      [26 - k, 15],
      [1, 15],
    ],
    "#d3b37f",
  );
  poly(
    c,
    [
      [4, 7],
      [30 - k, 7],
      [36 - k, 5],
      [36 - k, 15],
      [30 - k, 13],
      [4, 13],
    ],
    "#40565a",
  );
  rect(c, 36 - k, 7, 4, 6, "#f3dd9b");
  save(canvas, `sheets/recoil-${i}.png`);
}
for (let i = 0; i < 6; i++) {
  const { canvas, c } = make(64, 64);
  const r = [12, 16, 21, 21, 16, 12][i];
  circle(c, 32, 32, 30, "#8c6548");
  circle(c, 32, 32, 26, "#172a31");
  circle(c, 32, 32, r, "#03080b");
  for (let a = 0; a < 12; a++) {
    const t = (a * Math.PI) / 6;
    poly(
      c,
      [
        [32 + (r + 1) * Math.cos(t - 0.13), 32 + (r + 1) * Math.sin(t - 0.13)],
        [32 + 27 * Math.cos(t), 32 + 27 * Math.sin(t)],
        [32 + (r + 1) * Math.cos(t + 0.13), 32 + (r + 1) * Math.sin(t + 0.13)],
      ],
      "#c69763",
    );
  }
  save(canvas, `sheets/swallow-${i}.png`);
}
for (let i = 0; i < 6; i++) {
  const { canvas, c } = make(48, 48);
  const r = [5, 10, 17, 22, 19, 13][i];
  circle(c, 24, 24, r, "#c8f7e955");
  circle(c, 24, 24, Math.max(1, r - 4), "#f5ffff66");
  for (let j = 0; j < 8; j++) {
    const t = (j * Math.PI) / 4;
    line(
      c,
      [
        [24 + (r + 1) * Math.cos(t), 24 + (r + 1) * Math.sin(t)],
        [24 + (r + 4) * Math.cos(t), 24 + (r + 4) * Math.sin(t)],
      ],
      "#f7fff0",
      2,
    );
  }
  save(canvas, `sheets/flash-${i}.png`);
}
