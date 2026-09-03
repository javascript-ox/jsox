<script>
  let { release } = $props();
  let checks = $state([]);
  let passed = $derived(checks.filter((check) => check.passed).length);
  let percent = $derived(checks.length ? Math.round((passed / checks.length) * 100) : 0);

  $effect.pre(() => {
    if (checks.length === 0) checks.push(...release.checks.map((check) => ({ ...check })));
  });

  function toggle(index) {
    checks[index].passed = !checks[index].passed;
  }
</script>

<section class="launch-card">
  <header>
    <div>
      <p>Release candidate</p>
      <h2>{release.name}</h2>
    </div>
    <strong>{percent}%</strong>
  </header>
  <progress value={passed} max={checks.length}></progress>
  <ul>
    {#each checks as check, index}
      <li>
        <button type="button" class:passed={check.passed} onclick={() => toggle(index)}>
          <span>{check.passed ? "✓" : "○"}</span>
          {check.label}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .launch-card { max-width: 44rem; margin: 0 auto; padding: 1.5rem; border: 1px solid #ded5c7; border-top: .35rem solid #ff3e00; border-radius: .9rem; background: #fffdf8; box-shadow: 0 1rem 2.5rem rgb(47 39 30 / .08); }
  header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
  header p { margin: 0; color: #ff3e00; font-size: .72rem; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  h2 { margin: .25rem 0 1rem; font: 750 1.7rem/1.1 ui-sans-serif, system-ui; }
  header strong { color: #ff3e00; font: 750 2rem/1 ui-monospace, monospace; }
  progress { width: 100%; accent-color: #ff3e00; }
  ul { display: grid; gap: .55rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  button { width: 100%; display: flex; gap: .7rem; padding: .8rem 1rem; border: 1px solid #ded5c7; border-radius: .65rem; background: #fff; color: #2d2925; font: 650 .95rem ui-sans-serif, system-ui; text-align: left; cursor: pointer; }
  button.passed { border-color: #65a30d; background: #f7fee7; }
</style>
