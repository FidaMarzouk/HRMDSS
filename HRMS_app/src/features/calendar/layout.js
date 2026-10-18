// Side-by-side layout for overlapping blocks on one track (a day column or a
// resource lane): each block gets a column index and the number of columns of
// its overlap group. items: [{ from, to, ... }] in minutes.
export function packColumns(items) {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to);
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = [];
    group.forEach((item) => {
      let col = cols.findIndex((end) => end <= item.from);
      if (col === -1) col = cols.push(0) - 1;
      cols[col] = item.to;
      item.col = col;
    });
    group.forEach((item) => out.push({ ...item, cols: cols.length }));
    group = [];
  };
  sorted.forEach((item) => {
    if (group.length && item.from >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.to);
  });
  if (group.length) flush();
  return out;
}
