// Lógica pura da Aula II, compartilhada pelo exercício do aluno (A) e pelo
// painel do professor (B). Sem DOM e sem rede: recebe o estado e o conteúdo,
// devolve números e textos. É injetada nos dois HTML pela montagem e testada
// em Node (test/logica.test.mjs), por isso se registra num global.
(function (raiz) {
  "use strict";

  var NF = new Intl.NumberFormat("pt-BR");

  // --- Modelo ilustrativo dos medidores (plano, seção 5) --------------------

  // Terceiros alcançados pela cerca: densidade × área × (1 + janela/permanência).
  // O fator (1 + T/τ) conta quem já estava no círculo mais quem entrou durante
  // a janela, com permanência média τ.
  function terceiros(raio, janelaMin, modelo) {
    return modelo.rho * Math.PI * raio * raio * (1 + janelaMin / modelo.tau);
  }

  // Chance de o aparelho do sacador cair dentro do raio: CDF de Rayleigh.
  // Erro de localização é radial; 1 − exp(−r²/2σ²), não 50% simétricos.
  function captura(raio, sigma) {
    return 1 - Math.exp(-(raio * raio) / (2 * sigma * sigma));
  }

  function formatarTerceiros(n) {
    if (n < 1000) return "≈ " + NF.format(Math.round(n / 10) * 10);
    if (n < 10000) return "≈ " + NF.format(Math.round(n / 100) * 100);
    return "≈ " + NF.format(Math.round(n / 1000)) + " mil";
  }

  function formatarPct(p) {
    if (p >= 0.995) return "> 99%";
    if (p < 0.005) return "< 1%";
    return Math.round(p * 100) + "%";
  }

  // Janela centrada no horário do registro do banco ("13:47").
  function janelaHorario(centro, janelaMin) {
    var partes = centro.split(":");
    var c = Number(partes[0]) * 60 + Number(partes[1]);
    var meia = janelaMin / 2;
    function fmt(min) {
      var h = Math.floor(min / 60);
      var m = Math.round(min % 60);
      return h + "h" + (m < 10 ? "0" + m : m);
    }
    return { inicio: fmt(c - meia), fim: fmt(c + meia) };
  }

  function grandezaPalavra(termo, dias, palavras) {
    var linha = palavras.grandeza[termo];
    return linha ? linha[String(dias)] : "";
  }

  function termoGenerico(termo, palavras) {
    var t = palavras.termos.find(function (x) { return x.id === termo; });
    return t ? t.generico : true;
  }

  // --- Decisão (Tarefa 2) ---------------------------------------------------

  // Parâmetros que a decisão efetivamente autoriza. "Defiro" concede o pedido
  // como veio (300 m, 13h às 15h, os dois termos, 30 dias, sem etapas);
  // "defiro com restrições" usa o que o aluno escolheu nas telas 7 e 9.
  function parametrosEfetivos(estado, conteudo) {
    var m = conteudo.modelo;
    var dc = estado.decisao.cerca.escolha;
    var dp = estado.decisao.palavra.escolha;
    var cerca = { escolha: dc, deferida: dc === "defiro" || dc === "restricoes" };
    if (dc === "defiro") {
      cerca.raio = m.raio.pedido;
      cerca.janela = m.janela.pedido;
      cerca.etapas = false;
    } else {
      cerca.raio = estado.raio;
      cerca.janela = estado.janela;
      cerca.etapas = Boolean(estado.etapas);
    }
    cerca.terceiros = terceiros(cerca.raio, cerca.janela, m);
    cerca.captura = captura(cerca.raio, m.sigma);

    var palavra = { escolha: dp, deferida: dp === "defiro" || dp === "restricoes" };
    if (dp === "defiro") {
      palavra.termo = "pedido";
      palavra.dias = 30;
    } else {
      palavra.termo = estado.termo;
      palavra.dias = estado.dias;
    }
    palavra.generico = termoGenerico(palavra.termo, conteudo.palavras);
    palavra.grandeza = grandezaPalavra(palavra.termo, palavra.dias, conteudo.palavras);
    return { cerca: cerca, palavra: palavra };
  }

  function decisaoCompleta(estado) {
    var d = estado.decisao;
    return Boolean(d.cerca.escolha && d.palavra.escolha);
  }

  // Seis sinais de incoerência (plano, tela 10), inspirados no CPP,
  // art. 315, §2º. Cada um olha só a sua condição, para que uma combinação
  // de teste dispare apenas o seu sinal.
  function sinaisIncoerencia(estado, conteudo) {
    if (!decisaoCompleta(estado)) return [];
    var p = parametrosEfetivos(estado, conteudo);
    var m = conteudo.modelo;
    var d = estado.decisao;
    var sinais = [];

    if (estado.necessidade === "nao" && (p.cerca.deferida || p.palavra.deferida)) {
      sinais.push("necessidade");
    }
    if (estado.adotaHediondos && p.palavra.deferida) {
      sinais.push("hediondos");
    }
    if (p.cerca.deferida && p.cerca.captura < m.limite_captura) {
      sinais.push("adequacao");
    }
    if (p.cerca.deferida && p.cerca.terceiros > m.limite_terceiros && !p.cerca.etapas) {
      sinais.push("estrita");
    }
    if (p.palavra.deferida && p.palavra.generico) {
      sinais.push("tematica");
    }
    var motivoVazio = function (perna) {
      var f = d[perna].fundamento;
      return d[perna].escolha === "indefiro" && (!f || f === "generico");
    };
    if (motivoVazio("cerca") || motivoVazio("palavra")) {
      sinais.push("motivacao");
    }
    return sinais;
  }

  function textoFundamento(perna, id, conteudo) {
    var lista = conteudo.decisao.fundamentos_indeferimento[perna];
    var f = lista.find(function (x) { return x.id === id; });
    return f ? f.texto : "motivo não indicado";
  }

  function rotuloTermo(termo, conteudo) {
    var t = conteudo.palavras.termos.find(function (x) { return x.id === termo; });
    return t ? t.rotulo.replace(/^Só /, "").replace(/^Os dois termos, como pedido$/, "os dois termos") : termo;
  }

  // Dispositivo de quatro ou cinco linhas montado com as escolhas do aluno.
  function montarDispositivo(estado, conteudo) {
    if (!decisaoCompleta(estado)) return [];
    var p = parametrosEfetivos(estado, conteudo);
    var m = conteudo.modelo;
    var d = estado.decisao;
    var linhas = ["Vistos. Decido a representação em duas partes."];

    if (p.cerca.escolha === "indefiro") {
      linhas.push("Cerca geográfica: INDEFIRO, por " + textoFundamento("cerca", d.cerca.fundamento, conteudo) + ".");
    } else {
      var j = janelaHorario(m.centro, p.cerca.janela);
      var cab = p.cerca.escolha === "defiro" ? "DEFIRO, como requerida" : "DEFIRO COM RESTRIÇÕES";
      var txt = "Cerca geográfica: " + cab + ": raio de " + p.cerca.raio + " m, das " + j.inicio + " às " + j.fim;
      txt += p.cerca.etapas
        ? ", com procedimento em etapas e identificação dos remanescentes só por nova decisão."
        : ".";
      linhas.push(txt);
      linhas.push(
        "Chance estimada de alcançar o sacador: " + formatarPct(p.cerca.captura) +
        ". Terceiros alcançados: " + formatarTerceiros(p.cerca.terceiros) + " (estimativa ilustrativa)."
      );
    }

    if (p.palavra.escolha === "indefiro") {
      linhas.push("Palavras-chave: INDEFIRO, por " + textoFundamento("palavra", d.palavra.fundamento, conteudo) + ".");
    } else {
      var cabp = p.palavra.escolha === "defiro" ? "DEFIRO, como requerida" : "DEFIRO COM RESTRIÇÕES";
      linhas.push(
        "Palavras-chave: " + cabp + ": " + rotuloTermo(p.palavra.termo, conteudo) +
        ", nos " + p.palavra.dias + " dias anteriores ao saque. Alcance estimado: " + p.palavra.grandeza + " de usuários."
      );
    }
    linhas.push("Intime-se.");
    return linhas;
  }

  // Cartão de decisão para erguer em sala.
  function cartao(estado, conteudo) {
    if (!decisaoCompleta(estado)) return null;
    var p = parametrosEfetivos(estado, conteudo);
    var nome = { defiro: "DEFIRO", restricoes: "DEFIRO COM RESTRIÇÕES", indefiro: "INDEFIRO" };
    var c = nome[p.cerca.escolha];
    if (p.cerca.escolha !== "indefiro") {
      c += " · " + p.cerca.raio + " m · " + p.cerca.janela + " min";
      if (p.cerca.etapas) c += " · em etapas";
    }
    var w = nome[p.palavra.escolha];
    if (p.palavra.escolha === "restricoes") {
      w += " · " + (p.palavra.termo === "nome" ? "nome da vítima" : p.palavra.termo === "central" ? "central + banco" : "os dois termos");
      w += " · " + p.palavra.dias + " dias";
    }
    return { cerca: c, palavra: w };
  }

  // --- Tarefa 1 -------------------------------------------------------------

  // Grade 4×3: para cada elo e coluna, o tipo do cartão escolhido
  // ("correta", "parcial", "distrator") ou null.
  function gradeEsteira(respostas, conteudo) {
    return conteudo.elos.map(function (elo) {
      return conteudo.colunas.map(function (col) {
        var escolhido = respostas[elo.id + "." + col.id];
        if (!escolhido) return null;
        var cartao = elo.celulas[col.id].cartoes.find(function (c) { return c.id === escolhido; });
        return cartao ? cartao.tipo : null;
      });
    });
  }

  function placarEsteira(respostas, conteudo) {
    var grade = gradeEsteira(respostas, conteudo);
    var t = { correta: 0, parcial: 0, distrator: 0, vazia: 0 };
    grade.forEach(function (linha) {
      linha.forEach(function (tipo) { t[tipo || "vazia"] += 1; });
    });
    return t;
  }

  function estadoInicial(conteudo) {
    return {
      v: 1,
      tela: 0,
      respostas: {},
      requisitos: {},
      raio: conteudo.modelo.raio.pedido,
      janela: conteudo.modelo.janela.pedido,
      termo: "pedido",
      dias: 30,
      necessidade: null,
      gravidade: null,
      adotaHediondos: false,
      etapas: false,
      decisao: {
        cerca: { escolha: null, fundamento: null },
        palavra: { escolha: null, fundamento: null }
      }
    };
  }

  raiz.Aula2Logica = {
    terceiros: terceiros,
    captura: captura,
    formatarTerceiros: formatarTerceiros,
    formatarPct: formatarPct,
    janelaHorario: janelaHorario,
    grandezaPalavra: grandezaPalavra,
    parametrosEfetivos: parametrosEfetivos,
    sinaisIncoerencia: sinaisIncoerencia,
    montarDispositivo: montarDispositivo,
    cartao: cartao,
    gradeEsteira: gradeEsteira,
    placarEsteira: placarEsteira,
    estadoInicial: estadoInicial
  };
})(typeof window !== "undefined" ? window : globalThis);
