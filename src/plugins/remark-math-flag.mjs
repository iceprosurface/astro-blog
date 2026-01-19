import { visit } from 'unist-util-visit';

export default function remarkMathFlag() {
  return (tree, file) => {
    let hasMath = false;
    visit(tree, ['math', 'inlineMath'], () => {
      hasMath = true;
      return false;
    });

    if (hasMath) {
      if (!file.data.astro) file.data.astro = {};
      if (!file.data.astro.frontmatter) file.data.astro.frontmatter = {};
      file.data.astro.frontmatter.hasMath = true;
    }
  };
}
