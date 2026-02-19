<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import * as XLSX from "xlsx";

  let session: any = null;
  let authLoading = true;
  let email = "";
  let password = "";
  let loginLoading = false;
  let loginErr = "";

  let uploadFile: File | null = null;
  let uploading = false;
  let uploadOk = "";
  let uploadErr = "";
  let dragOver = false;

  let batches: any[] = [];
  let batchesLoading = false;
  let deletingId: string | null = null;

  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    authLoading = false;
    if (session) loadBatches();
    supabase.auth.onAuthStateChange((_e, s) => {
      session = s;
      if (s) loadBatches();
    });
  });

  async function login() {
    loginLoading = true;
    loginErr = "";
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) loginErr = "Credenciales incorrectas.";
    loginLoading = false;
  }

  async function logout() {
    await supabase.auth.signOut();
    batches = [];
  }

  async function loadBatches() {
    batchesLoading = true;
    const { data } = await supabase
      .from("excel_batches")
      .select("*")
      .order("uploaded_at", { ascending: false });
    batches = data ?? [];
    batchesLoading = false;
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      uploadFile = input.files[0];
      uploadOk = "";
      uploadErr = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f?.name.endsWith(".xlsx")) {
      uploadFile = f;
      uploadOk = "";
      uploadErr = "";
    } else uploadErr = "Solo se aceptan archivos .xlsx";
  }

  async function processUpload() {
    if (!uploadFile) return;
    uploading = true;
    uploadOk = "";
    uploadErr = "";
    try {
      const buf = await uploadFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const records: any[] = [];
      for (const row of rows) {
        if (!row[0] || !row[1]) continue;
        const imei = String(row[1]).replace(/\D/g, "");
        if (imei.length >= 14) {
          records.push({
            modelo: String(row[0]).trim(),
            imei,
            codigo_registro: row[2] ? String(row[2]).trim() : "",
          });
        }
      }

      if (!records.length) {
        uploadErr = "No se encontraron registros válidos.";
        uploading = false;
        return;
      }

      const { data: batch, error: be } = await supabase
        .from("excel_batches")
        .insert({
          filename: uploadFile.name,
          record_count: records.length,
          uploaded_by: session?.user?.email,
        })
        .select()
        .single();
      if (be) throw be;

      for (let i = 0; i < records.length; i += 500) {
        const { error: ie } = await supabase.from("imei_records").upsert(
          records.slice(i, i + 500).map((r) => ({ ...r, batch_id: batch.id })),
          { onConflict: "imei" },
        );
        if (ie) throw ie;
      }

      uploadOk = `${records.length} registros cargados de "${uploadFile.name}"`;
      uploadFile = null;
      const fi = document.getElementById("file-inp") as HTMLInputElement;
      if (fi) fi.value = "";
      await loadBatches();
    } catch (e: any) {
      uploadErr = `Error: ${e.message ?? "Ocurrió un problema."}`;
    } finally {
      uploading = false;
    }
  }

  async function deleteBatch(id: string) {
    if (!confirm("¿Eliminar este lote y todos sus registros IMEI?")) return;
    deletingId = id;
    await supabase.from("excel_batches").delete().eq("id", id);
    await loadBatches();
    deletingId = null;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
</script>

<svelte:head>
  <title>Admin — OSIPTEL Preventivo</title>
</svelte:head>

<div class="page">
  {#if authLoading}
    <div class="center">
      <div class="spin" style="width:28px;height:28px"></div>
    </div>
  {:else if !session}
    <!-- LOGIN -->
    <div class="login-wrap">
      <div class="login-brand">
        <img src="/images/logo.png" alt="OSIPTEL Preventivo" class="logo-img" />
      </div>

      <h1>Panel de administración</h1>
      <p class="sub">Acceso restringido al administrador.</p>

      <form class="login-form card" on:submit|preventDefault={login}>
        <div class="fg">
          <label class="form-lbl" for="adm-email">Correo</label>
          <input
            id="adm-email"
            class="inp"
            type="email"
            bind:value={email}
            placeholder="admin@correo.com"
            required
            autocomplete="email"
          />
        </div>
        <div class="fg">
          <label class="form-lbl" for="adm-pw">Contraseña</label>
          <input
            id="adm-pw"
            class="inp"
            type="password"
            bind:value={password}
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>
        {#if loginErr}
          <div class="alert alert-err">{loginErr}</div>
        {/if}
        <button
          id="login-btn"
          class="btn btn-white"
          type="submit"
          disabled={loginLoading}
          style="width:100%"
        >
          {#if loginLoading}<div class="spin"></div>
            Ingresando...{:else}Ingresar{/if}
        </button>
      </form>
    </div>
  {:else}
    <!-- DASHBOARD -->
    <div class="dash">
      <!-- Top bar -->
      <div class="topbar">
        <div class="top-brand">
          <img
            src="/images/logo.png"
            alt="OSIPTEL Preventivo"
            class="logo-img-sm"
          />
        </div>
        <div class="top-right">
          <span class="email-lbl">{session.user.email}</span>
          <button class="btn btn-ghost" on:click={logout}>Salir</button>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-n">{batches.length}</span>
          <span class="stat-l">Archivos</span>
        </div>
        <div class="stat-div"></div>
        <div class="stat">
          <span class="stat-n"
            >{batches
              .reduce((s, b) => s + b.record_count, 0)
              .toLocaleString()}</span
          >
          <span class="stat-l">Registros IMEI</span>
        </div>
      </div>

      <!-- Upload -->
      <div class="card section">
        <h2 class="section-title">Subir archivo Excel</h2>
        <p class="section-sub">
          El archivo debe tener: columna A = modelo, columna B = IMEI, columna C
          = código (opcional).
        </p>

        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="drop"
          class:drag-on={dragOver}
          class:has-file={uploadFile}
          on:dragover|preventDefault={() => (dragOver = true)}
          on:dragleave={() => (dragOver = false)}
          on:drop={onDrop}
          on:click={() => document.getElementById("file-inp")?.click()}
        >
          <input
            id="file-inp"
            type="file"
            accept=".xlsx"
            style="display:none"
            on:change={onFileChange}
          />

          {#if uploadFile}
            <div class="file-row">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="color:#888;flex-shrink:0"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div class="file-info">
                <div class="file-name">{uploadFile.name}</div>
                <div class="file-size">{fmtSize(uploadFile.size)}</div>
              </div>
              <button
                class="x-btn"
                on:click|stopPropagation={() => {
                  uploadFile = null;
                  uploadOk = "";
                  uploadErr = "";
                }}
                aria-label="Quitar">✕</button
              >
            </div>
          {:else}
            <div class="drop-idle">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                style="color:#333"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p class="drop-txt">
                Arrastra el archivo aquí o haz clic para seleccionar
              </p>
              <p class="drop-hint">Solo archivos .xlsx</p>
            </div>
          {/if}
        </div>

        {#if uploadOk}
          <div class="alert alert-ok">{uploadOk}</div>
        {/if}
        {#if uploadErr}
          <div class="alert alert-err">{uploadErr}</div>
        {/if}

        <button
          id="upload-btn"
          class="btn btn-white"
          on:click={processUpload}
          disabled={!uploadFile || uploading}
          style="align-self:flex-start"
        >
          {#if uploading}<div class="spin"></div>
            Procesando...{:else}Procesar y subir{/if}
        </button>
      </div>

      <!-- Batch list -->
      <div class="card section">
        <h2 class="section-title">Archivos cargados</h2>

        {#if batchesLoading}
          <div class="center" style="padding:1.5rem">
            <div class="spin"></div>
          </div>
        {:else if batches.length === 0}
          <p class="empty">Ningún archivo cargado aún.</p>
        {:else}
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Registros</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each batches as b (b.id)}
                  <tr>
                    <td style="color:#ccc;font-weight:500">{b.filename}</td>
                    <td
                      ><span class="badge badge-ok"
                        >{b.record_count.toLocaleString()}</span
                      ></td
                    >
                    <td style="font-size:0.8rem">{fmtDate(b.uploaded_at)}</td>
                    <td style="text-align:right">
                      <button
                        class="btn btn-del"
                        on:click={() => deleteBatch(b.id)}
                        disabled={deletingId === b.id}
                      >
                        {#if deletingId === b.id}<div
                            class="spin"
                            style="width:12px;height:12px;border-width:1.5px"
                          ></div>{:else}Eliminar{/if}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 2rem 1.25rem;
  }

  .center {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }

  /* Login */
  .login-wrap {
    max-width: 400px;
    margin: 0 auto;
    padding-top: 6vh;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .login-brand {
    margin-bottom: 0.5rem;
  }

  .logo-img {
    max-width: 180px;
    width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
  }

  .logo-img-sm {
    max-height: 28px;
    width: auto;
    display: block;
    object-fit: contain;
  }

  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: -0.04em;
  }
  .sub {
    font-size: 0.85rem;
    color: #555;
    margin-top: -4px;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 0.5rem;
  }
  .fg {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  /* Dashboard */
  .dash {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid #1c1c1c;
    gap: 12px;
  }

  .top-brand {
    display: flex;
    align-items: center;
  }

  .top-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .email-lbl {
    font-size: 0.78rem;
    color: #444;
    display: none;
  }

  @media (min-width: 500px) {
    .email-lbl {
      display: block;
    }
  }

  /* Stats */
  .stats-bar {
    display: flex;
    align-items: center;
    gap: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 16px 24px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-n {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: #f5f5f5;
  }
  .stat-l {
    font-size: 0.72rem;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }
  .stat-div {
    width: 1px;
    height: 36px;
    background: #222;
  }

  /* Section */
  .section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #ddd;
  }
  .section-sub {
    font-size: 0.8rem;
    color: #444;
    margin-top: -8px;
  }

  /* Drop zone */
  .drop {
    border: 1.5px dashed #232323;
    border-radius: 8px;
    cursor: pointer;
    transition: var(--t);
    background: #0e0e0e;
  }

  .drop:hover,
  .drag-on {
    border-color: #383838;
    background: #141414;
  }
  .has-file {
    border-style: solid;
    border-color: #2a2a2a;
  }

  .drop-idle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 32px;
  }
  .drop-txt {
    font-size: 0.85rem;
    color: #444;
  }
  .drop-hint {
    font-size: 0.75rem;
    color: #2d2d2d;
  }

  .file-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    text-align: left;
  }

  .file-info {
    flex: 1;
  }
  .file-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #ccc;
  }
  .file-size {
    font-size: 0.75rem;
    color: #444;
    margin-top: 2px;
  }

  .x-btn {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    color: #555;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.7rem;
    flex-shrink: 0;
    transition: var(--t);
  }
  .x-btn:hover {
    color: var(--err);
    border-color: var(--err-border);
  }

  /* Table wrapper */
  .tbl-wrap {
    overflow-x: auto;
    border-radius: 6px;
    border: 1px solid #1a1a1a;
  }

  .empty {
    font-size: 0.85rem;
    color: #333;
    padding: 1rem 0;
  }
</style>
