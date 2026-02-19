<script lang="ts">
  import { supabase } from "$lib/supabase";

  let imei = "";
  let loading = false;
  let result: { found: boolean; data?: any } | null = null;
  let err = "";

  function clean(v: string) {
    return v.replace(/\D/g, "").slice(0, 15);
  }

  function onInput(e: Event) {
    const t = e.target as HTMLInputElement;
    imei = clean(t.value);
    t.value = imei;
    result = null;
    err = "";
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") check();
  }

  async function check() {
    if (imei.length < 14) {
      err = "Ingresa un IMEI válido (mínimo 14 dígitos).";
      return;
    }
    loading = true;
    result = null;
    err = "";
    try {
      const { data, error: dbe } = await supabase
        .from("imei_records")
        .select("modelo, imei, codigo_registro, excel_batches(uploaded_at)")
        .eq("imei", imei)
        .maybeSingle();
      if (dbe) throw dbe;
      result = data
        ? {
            found: true,
            data: {
              ...data,
              uploaded_at: (data as any).excel_batches?.uploaded_at ?? "",
            },
          }
        : { found: false };
    } catch {
      err = "Error al consultar la base de datos. Intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  function fmtDate(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
</script>

<svelte:head>
  <title>OSIPTEL Preventivo — Verificador IMEI</title>
  <meta
    name="description"
    content="Verifica si tu dispositivo está registrado en la base de datos de OSIPTEL Preventivo."
  />
</svelte:head>

<div class="page">
  <main>
    <!-- Logo -->
    <div class="brand">
      <img src="/images/logo.png" alt="OSIPTEL Preventivo" class="logo-img" />
    </div>

    <!-- Heading -->
    <h1>Verificador de IMEI</h1>
    <p class="sub">
      Consulta si tu dispositivo figura en el registro preventivo.<br />
      Ingresa el número IMEI de 15 dígitos.
    </p>

    <!-- Search box -->
    <div class="search-box card">
      <div class="row">
        <div class="inp-wrap">
          <input
            id="imei-input"
            class="inp imei-inp mono"
            type="text"
            inputmode="numeric"
            placeholder="000000000000000"
            maxlength="15"
            value={imei}
            on:input={onInput}
            on:keydown={onKey}
            disabled={loading}
            autocomplete="off"
          />
          {#if imei.length > 0}
            <span class="counter">{imei.length}/15</span>
          {/if}
        </div>
        <button
          id="check-btn"
          class="btn btn-white"
          on:click={check}
          disabled={loading || imei.length < 14}
        >
          {#if loading}
            <div class="spin"></div>
            Verificando
          {:else}
            Verificar
          {/if}
        </button>
      </div>

      {#if err}
        <div class="alert alert-err" role="alert">{err}</div>
      {/if}

      {#if result !== null}
        <div
          class="result"
          class:result-ok={result.found}
          class:result-no={!result.found}
        >
          {#if result.found && result.data}
            <!-- Found -->
            <div class="res-top">
              <div class="res-dot dot-ok"></div>
              <span class="res-label ok-txt">Dispositivo registrado</span>
            </div>
            <div class="res-grid">
              <div class="res-field">
                <div class="form-lbl">Modelo</div>
                <div class="res-val">{result.data.modelo}</div>
              </div>
              <div class="res-field">
                <div class="form-lbl">IMEI</div>
                <div class="res-val mono">{result.data.imei}</div>
              </div>
              <div class="res-field">
                <div class="form-lbl">Código de registro</div>
                <div class="res-val mono">
                  {result.data.codigo_registro || "—"}
                </div>
              </div>
              <div class="res-field">
                <div class="form-lbl">Fecha de registro</div>
                <div class="res-val">{fmtDate(result.data.uploaded_at)}</div>
              </div>
            </div>
          {:else}
            <!-- Not found -->
            <div class="res-top">
              <div class="res-dot dot-no"></div>
              <span class="res-label">Dispositivo no encontrado</span>
            </div>
            <p class="res-sub">
              Este IMEI no figura en nuestra base de datos preventiva.
            </p>
          {/if}
        </div>
      {/if}
    </div>

    <p class="hint">
      ¿Dónde encuentro mi IMEI? Marca <code>*#06#</code> en tu teléfono.
    </p>
  </main>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
  }

  main {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.1rem;
    text-align: center;
  }

  /* Brand / Logo */
  .brand {
    margin-bottom: 0.5rem;
  }

  .logo-img {
    max-width: 200px;
    width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
  }

  /* Heading */
  h1 {
    font-size: clamp(2rem, 5vw, 2.8rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.1;
    color: #f5f5f5;
  }

  .sub {
    font-size: 0.9rem;
    color: #666;
    line-height: 1.65;
    max-width: 380px;
  }

  /* Search box card */
  .search-box {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
  }

  .row {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .inp-wrap {
    position: relative;
    flex: 1;
  }

  .imei-inp {
    padding-right: 48px;
    font-size: 1rem;
    letter-spacing: 0.06em;
  }

  .counter {
    position: absolute;
    right: 13px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: #3a3a3a;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }

  /* Result */
  .result {
    border-radius: 8px;
    padding: 16px;
    border: 1px solid;
    text-align: left;
    animation: fadein 0.25s ease;
  }

  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .result-ok {
    background: var(--ok-bg);
    border-color: var(--ok-border);
  }
  .result-no {
    background: #141414;
    border-color: var(--border);
  }

  .res-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .res-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-ok {
    background: var(--ok);
    box-shadow: 0 0 6px var(--ok);
  }
  .dot-no {
    background: #3a3a3a;
  }

  .res-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #ccc;
  }
  .ok-txt {
    color: var(--ok);
  }
  .res-sub {
    font-size: 0.82rem;
    color: var(--text-3);
    margin-top: -8px;
  }

  .res-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .res-field {
  }
  .res-val {
    font-size: 0.875rem;
    font-weight: 600;
    color: #ddd;
    margin-top: 3px;
  }

  /* Hint */
  .hint {
    font-size: 0.75rem;
    color: #3a3a3a;
  }

  .hint code {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.85em;
    color: #888;
  }

  @media (max-width: 440px) {
    .row {
      flex-direction: column;
    }
    .res-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
