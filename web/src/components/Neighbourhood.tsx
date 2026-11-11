// A Gujarati street at sunrise for the landing page: a two-storey home with a parapet, a black
// rooftop water tank and tilted solar panels; a tiled bungalow with panels on its roof; an apartment
// block with balconies and AC units; neem trees, a compound wall with a gate, a street lamp and the
// footpath. Side walls are shaded and some windows are lit. The trees sway and the panels glint.
export function Neighbourhood({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <pattern id="cells" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#24425f" />
          <path d="M0 0H9V9" fill="none" stroke="#7b98b3" strokeWidth=".7" />
        </pattern>
        <pattern id="tiles" width="14" height="8" patternUnits="userSpaceOnUse">
          <rect width="14" height="8" fill="#b5674a" />
          <path d="M0 7.5H14M7 0V7.5" stroke="#97503a" strokeWidth="1" />
        </pattern>
        <linearGradient id="lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dca6" />
          <stop offset="1" stopColor="#e9b872" />
        </linearGradient>
        <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9db4c9" />
          <stop offset="1" stopColor="#6e8fae" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tank" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f1f1f" />
          <stop offset=".45" stopColor="#4a4a4a" />
          <stop offset="1" stopColor="#1b1b1b" />
        </linearGradient>
      </defs>

      {/* Distant hills */}
      <path d="M0 175 120 140l140 30 170-60 150 45 140-35 200 55 170-40 190 50 160-30v250H0z" fill="#d5dccb" />
      <path d="M0 205 160 172l180 28 200-38 220 36 180-26 230 34 270-24v190H0z" fill="#c4cfb8" />

      {/* ── Home 1: two storeys, flat roof, parapet, water tank, solar ── */}
      <g>
        {/* tilted solar array on legs */}
        <path d="M168 104l12-16M276 104l12-16M200 104v-6M258 104v-6" stroke="#55606a" strokeWidth="2.5" />
        <path d="M156 92 180 66h118l-24 26z" fill="url(#cells)" stroke="#c9d3dc" strokeWidth="2" />
        <path className="anim-glint" d="M156 92 180 66h30l-24 26z" fill="url(#sheen)" />
        {/* water tank */}
        <rect x="102" y="70" width="36" height="34" rx="5" fill="url(#tank)" />
        <ellipse cx="120" cy="70" rx="18" ry="4" fill="#3a3a3a" />
        <path d="M102 80h36M102 92h36" stroke="#000" strokeOpacity=".35" />
        <rect x="104" y="104" width="32" height="6" fill="#8b7a63" />
        {/* side face, shaded */}
        <path d="M296 112l30 10v158l-30-10z" fill="#cdb592" />
        {/* front */}
        <rect x="88" y="110" width="210" height="12" fill="#dcc7a6" />
        <rect x="92" y="122" width="204" height="148" fill="#ecdcc1" />
        <rect x="84" y="186" width="218" height="8" fill="#c9ae86" />
        <rect x="92" y="194" width="204" height="5" fill="#000" opacity=".08" />
        {/* first-floor balcony with a French window */}
        <rect x="150" y="136" width="88" height="48" fill="url(#lit)" stroke="#8e5a43" strokeWidth="3" />
        <path d="M194 136v48M150 160h88" stroke="#8e5a43" strokeWidth="2" />
        <rect x="140" y="164" width="108" height="3" fill="#6f5a45" />
        <path d="M144 167v19M154 167v19M164 167v19M174 167v19M184 167v19M194 167v19M204 167v19M214 167v19M224 167v19M234 167v19M244 167v19" stroke="#6f5a45" strokeWidth="2" />
        <rect x="104" y="140" width="32" height="38" fill="url(#dark)" stroke="#8e5a43" strokeWidth="3" />
        <path d="M120 140v38" stroke="#8e5a43" strokeWidth="2" />
        <rect x="254" y="140" width="32" height="38" fill="url(#lit)" stroke="#8e5a43" strokeWidth="3" />
        <path d="M270 140v38" stroke="#8e5a43" strokeWidth="2" />
        {/* AC outdoor unit on the side wall */}
        <rect x="302" y="148" width="20" height="16" rx="2" fill="#f4f1ea" stroke="#b9b2a5" />
        <circle cx="312" cy="156" r="5" fill="none" stroke="#9a9384" />
        {/* ground floor: windows, door, steps */}
        <rect x="104" y="210" width="38" height="40" fill="url(#lit)" stroke="#8e5a43" strokeWidth="3" />
        <path d="M123 210v40M104 230h38" stroke="#8e5a43" strokeWidth="2" />
        <rect x="246" y="210" width="38" height="40" fill="url(#dark)" stroke="#8e5a43" strokeWidth="3" />
        <path d="M265 210v40M246 230h38" stroke="#8e5a43" strokeWidth="2" />
        <rect x="176" y="206" width="36" height="64" fill="#7a4f37" />
        <path d="M181 212h26v22h-26zM181 240h26v24h-26z" fill="none" stroke="#5e3a28" strokeWidth="2" />
        <circle cx="205" cy="240" r="2" fill="#e9b872" />
        <rect x="168" y="270" width="52" height="5" fill="#c9b79a" />
        {/* toran over the door */}
        <path d="M172 204q22 8 44 0" fill="none" stroke="#4e7d5e" strokeWidth="3" />
        <path d="M178 206l2 6M186 208l2 6M194 209l0 6M202 208l-2 6M210 206l-2 6" stroke="#c9873e" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* ── Neem tree ── */}
      <g className="anim-sway">
        <path d="M352 280c4-34 2-62-6-86M350 222c-14-10-26-14-38-14M348 208c12-12 24-16 36-16" stroke="#6b4c34" strokeWidth="9" strokeLinecap="round" fill="none" />
        <circle cx="346" cy="170" r="44" fill="#3f6b4e" />
        <circle cx="314" cy="196" r="28" fill="#4e7d5e" />
        <circle cx="380" cy="186" r="30" fill="#4e7d5e" />
        <circle cx="350" cy="146" r="28" fill="#5d8a69" />
        <circle cx="330" cy="160" r="14" fill="#6f9a7b" />
        <circle cx="368" cy="160" r="10" fill="#6f9a7b" />
      </g>

      {/* ── Home 2: tiled bungalow with a porch and solar on the roof ── */}
      <g>
        <path d="M612 178 646 194v80l-34-12z" fill="#d6c3a2" />
        <rect x="430" y="178" width="182" height="96" fill="#f2e5cc" />
        <path d="M416 182 452 122h150l26 60z" fill="url(#tiles)" />
        <path d="M416 182h212" stroke="#7c3f2c" strokeWidth="4" />
        <path d="M452 122h150" stroke="#7c3f2c" strokeWidth="3" />
        {/* panels on the roof plane */}
        <path d="M466 166 482 136h96l14 30z" fill="url(#cells)" stroke="#c9d3dc" strokeWidth="2" />
        <path className="anim-glint [animation-delay:-2s]" d="M466 166 482 136h26l-12 30z" fill="url(#sheen)" />
        {/* porch */}
        <rect x="486" y="196" width="72" height="6" fill="#c9ae86" />
        <rect x="490" y="202" width="7" height="72" fill="#e3d2b4" />
        <rect x="547" y="202" width="7" height="72" fill="#e3d2b4" />
        <rect x="506" y="214" width="32" height="60" fill="#8e5a43" />
        <path d="M510 220h24v20h-24zM510 246h24v22h-24z" fill="none" stroke="#6b3f2c" strokeWidth="2" />
        <rect x="442" y="204" width="34" height="38" fill="url(#lit)" stroke="#7a5a3f" strokeWidth="3" />
        <path d="M459 204v38" stroke="#7a5a3f" strokeWidth="2" />
        <rect x="436" y="204" width="6" height="38" fill="#4e7d5e" />
        <rect x="476" y="204" width="6" height="38" fill="#4e7d5e" />
        <rect x="568" y="204" width="34" height="38" fill="url(#dark)" stroke="#7a5a3f" strokeWidth="3" />
        <path d="M585 204v38" stroke="#7a5a3f" strokeWidth="2" />
        {/* tulsi pot and plants */}
        <rect x="466" y="256" width="16" height="18" fill="#b5674a" />
        <circle cx="474" cy="250" r="8" fill="#5d8a69" />
        <rect x="574" y="258" width="14" height="16" fill="#b5674a" />
        <circle cx="581" cy="252" r="7" fill="#6f9a7b" />
      </g>

      {/* ── Street lamp ── */}
      <g>
        <rect x="676" y="150" width="5" height="128" fill="#55606a" />
        <path d="M678 152q18-8 30 4" fill="none" stroke="#55606a" strokeWidth="4" />
        <rect x="700" y="154" width="16" height="6" rx="2" fill="#e9b872" />
      </g>

      {/* ── Home 3: four-storey apartments with balconies, ACs, tanks and solar on the terrace ── */}
      <g>
        <path d="M790 54 802 38h56l-12 16zM862 54 874 38h56l-12 16zM934 54 946 38h44l-10 16z" fill="url(#cells)" stroke="#c9d3dc" strokeWidth="1.5" />
        <path className="anim-glint [animation-delay:-3.5s]" d="M862 54 874 38h18l-12 16z" fill="url(#sheen)" />
        <rect x="752" y="36" width="24" height="22" rx="4" fill="url(#tank)" />
        <path d="M986 62l30 10v206l-30-10z" fill="#c9b08c" />
        <rect x="738" y="56" width="252" height="10" fill="#d8c3a1" />
        <rect x="742" y="66" width="244" height="212" fill="#e7d7bc" />
        {[0, 1, 2, 3].map((f) => {
          const y = 76 + f * 50;
          return (
            <g key={f}>
              <rect x="756" y={y} width="30" height="34" fill={f % 2 ? "url(#lit)" : "url(#dark)"} stroke="#8e5a43" strokeWidth="2.5" />
              <rect x="806" y={y} width="62" height="34" fill={f === 2 ? "url(#dark)" : "url(#lit)"} stroke="#8e5a43" strokeWidth="2.5" />
              <rect x="800" y={y + 24} width="74" height="14" fill="#d2bd98" />
              <path d={`M804 ${y + 24}v14M814 ${y + 24}v14M824 ${y + 24}v14M834 ${y + 24}v14M844 ${y + 24}v14M854 ${y + 24}v14M864 ${y + 24}v14`} stroke="#9c8463" strokeWidth="1.5" />
              <rect x="890" y={y} width="30" height="34" fill={f === 1 ? "url(#dark)" : "url(#lit)"} stroke="#8e5a43" strokeWidth="2.5" />
              <rect x="936" y={y} width="36" height="34" fill={f === 3 ? "url(#lit)" : "url(#dark)"} stroke="#8e5a43" strokeWidth="2.5" />
              <rect x="926" y={y + 6} width="10" height="2" fill="#6f5a45" />
              <rect x="990" y={y + 8} width="18" height="14" rx="2" fill="#f4f1ea" stroke="#b9b2a5" />
              <circle cx="999" cy={y + 15} r="4" fill="none" stroke="#9a9384" />
              <rect x="742" y={y + 44} width="244" height="4" fill="#000" opacity=".05" />
            </g>
          );
        })}
        <rect x="846" y="246" width="40" height="32" fill="#6b4c34" />
        <path d="M866 246v32" stroke="#4d3423" strokeWidth="2" />
      </g>

      {/* ── Second tree ── */}
      <g className="anim-sway [animation-delay:-3s]">
        <path d="M1040 280c3-26 1-48-5-66M1038 232c-10-8-20-10-28-10" stroke="#6b4c34" strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="1036" cy="196" r="34" fill="#3f6b4e" />
        <circle cx="1012" cy="214" r="22" fill="#4e7d5e" />
        <circle cx="1060" cy="208" r="24" fill="#4e7d5e" />
        <circle cx="1040" cy="176" r="20" fill="#5d8a69" />
        <circle cx="1024" cy="186" r="10" fill="#6f9a7b" />
      </g>

      {/* ── Home 4: modern home with a solar pergola and a big lit window ── */}
      <g>
        <path d="M1086 120h208l-16 12h-176z" fill="#55606a" />
        <path d="M1096 118 1110 92h170l-14 26z" fill="url(#cells)" stroke="#c9d3dc" strokeWidth="2" />
        <path className="anim-glint [animation-delay:-1s]" d="M1096 118 1110 92h30l-14 26z" fill="url(#sheen)" />
        <path d="M1110 132v-14M1270 132v-14" stroke="#55606a" strokeWidth="3" />
        <path d="M1282 132l28 10v136l-28-10z" fill="#cfb895" />
        <rect x="1094" y="132" width="188" height="146" fill="#f1e3c7" />
        <rect x="1094" y="132" width="188" height="10" fill="#dcc7a6" />
        <rect x="1110" y="156" width="96" height="62" fill="url(#lit)" stroke="#55606a" strokeWidth="3" />
        <path d="M1142 156v62M1174 156v62" stroke="#55606a" strokeWidth="2" />
        <rect x="1222" y="156" width="44" height="44" fill="url(#dark)" stroke="#55606a" strokeWidth="3" />
        <rect x="1228" y="222" width="36" height="56" fill="#3f6b4e" />
        <circle cx="1258" cy="252" r="2" fill="#e9b872" />
        <rect x="1110" y="232" width="96" height="6" fill="#c9ae86" />
      </g>

      {/* ── Compound walls and gates ── */}
      <g>
        <rect x="70" y="252" width="94" height="24" fill="#dccab0" />
        <rect x="222" y="252" width="104" height="24" fill="#dccab0" />
        <rect x="66" y="248" width="102" height="6" fill="#c9b493" />
        <rect x="218" y="248" width="112" height="6" fill="#c9b493" />
        <path d="M168 252h50M168 276h50M174 252v24M184 252v24M194 252v24M204 252v24M214 252v24" stroke="#55606a" strokeWidth="2.5" />
        <rect x="1086" y="254" width="122" height="22" fill="#dccab0" />
        <rect x="1082" y="250" width="130" height="6" fill="#c9b493" />
        <rect x="1294" y="254" width="80" height="22" fill="#dccab0" />
        <rect x="1290" y="250" width="88" height="6" fill="#c9b493" />
      </g>

      {/* ── Footpath and kerb ── */}
      <rect y="276" width="1440" height="24" fill="#d8cdb9" />
      <rect y="276" width="1440" height="3" fill="#c3b69e" />
      <path d="M0 290H1440" stroke="#cbbfa8" strokeDasharray="38 14" />
      <path d="M40 276l4-8 4 8M400 276l4-9 4 9M640 276l3-7 4 7M1120 276l4-8 4 8M1380 276l4-9 4 9" fill="#6f9a7b" />
    </svg>
  );
}
