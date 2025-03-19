// ==UserScript==
// @name         TEC Concursos - Contador Automático
// @namespace    http://localhost:5000/
// @version      0.8
// @description  Integra com o TEC Concursos para contar automaticamente acertos e erros, com opção de desfazer, painel arrastável e prevenção de contagens duplicadas
// @author       You
// @match        *://*.tecconcursos.com.br/*
// @match        https://www.tecconcursos.com.br/*
// @match        https://tecconcursos.com.br/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('TEC Concursos Counter v0.8 iniciado');
    
    // Configuração
    const API_URL = 'https://acssjr.pythonanywhere.com/api/increment';
    const UNDO_API_URL = 'https://acssjr.pythonanywhere.com/api/undo';
    
    // Mapa para armazenar questões já processadas
    const questoesProcessadas = carregarQuestoesProcessadas();
    
    // Carregar questões processadas do localStorage
    function carregarQuestoesProcessadas() {
        try {
            const dadosSalvos = localStorage.getItem('tecConcursosQuestoesProcessadas');
            return dadosSalvos ? JSON.parse(dadosSalvos) : {};
        } catch (error) {
            console.error('Erro ao carregar questões processadas:', error);
            return {};
        }
    }
    
    // Salvar questões processadas no localStorage
    function salvarQuestoesProcessadas() {
        try {
            localStorage.setItem('tecConcursosQuestoesProcessadas', JSON.stringify(questoesProcessadas));
        } catch (error) {
            console.error('Erro ao salvar questões processadas:', error);
        }
    }
    
    // Registrar questão processada
    function registrarQuestaoProcessada(id, tipo) {
        questoesProcessadas[id] = tipo;
        salvarQuestoesProcessadas();
    }
    
    // Remover questão processada (para desfazer)
    function removerQuestaoProcessada(id) {
        if (questoesProcessadas[id]) {
            delete questoesProcessadas[id];
            salvarQuestoesProcessadas();
            return true;
        }
        return false;
    }
    
    // Auxiliar para evitar múltiplas verificações simultâneas
    let verificandoResultado = false;
    
    // Inicializar quando o DOM estiver pronto
    window.addEventListener('load', function() {
        console.log('DOM carregado, inicializando contador...');
        init();
    });
    
    // Função principal de inicialização
    function init() {
        if (!window.location.hostname.includes('tecconcursos.com.br')) {
            console.log('Não estamos no TEC Concursos, abortando inicialização.');
            return;
        }
        
        // Injetar estilos CSS
        injetarCSS();
        
        // Adicionar botões manuais
        adicionarBotoes();
        
        // Detectar cliques em RESOLVER
        monitorarCliques();
        
        // Verificar periodicamente
        setInterval(verificarResultado, 2000);
        
        // Verificar imediatamente (para caso esteja carregando uma página com resultado)
        setTimeout(verificarResultado, 1000);
        
        // Mostrar notificação de inicialização
        mostrarNotificacao('Contador de Questões ativado!');
    }
    
    // Injetar estilos CSS
    function injetarCSS() {
        const estilos = `
            .tec-contador-flutuante {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: #1a1a1a;
                border-radius: 8px;
                padding: 12px;
                color: white;
                z-index: 9999;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(5px);
                width: auto;
                height: auto;
            }
            
            .tec-notificacao {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background-color: rgba(46, 204, 113, 0.9);
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .tec-notificacao.mostrar {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .tec-notificacao.erro {
                background-color: rgba(231, 76, 60, 0.9);
            }
        `;
        
        const styleTag = document.createElement('style');
        styleTag.textContent = estilos;
        document.head.appendChild(styleTag);
    }
    
    // Adicionar botões para contagem manual
    function adicionarBotoes() {
        console.log('Adicionando botões de contagem manual...');
        
        // Verificar se existe um painel oculto
        const painelExistente = document.getElementById('tec-contador-flutuante');
        if (painelExistente) {
            // Se existe mas está oculto, mostrar novamente
            if (painelExistente.style.display === 'none') {
                painelExistente.style.display = 'block';
                return;
            }
            return; // Painel já existe e está visível
        }
        
        // Container principal (painel flutuante)
        const container = document.createElement('div');
        container.id = 'tec-contador-flutuante';
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.bottom = '20px';
        container.style.width = 'auto'; // Permitir que a largura seja determinada pelo conteúdo
        container.style.height = 'auto'; // Permitir que a altura seja determinada pelo conteúdo
        container.style.backgroundColor = 'rgba(44, 62, 80, 0.85)';
        container.style.borderRadius = '8px';
        container.style.padding = '12px';
        container.style.color = 'white';
        container.style.zIndex = '9999';
        container.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        container.style.backdropFilter = 'blur(5px)';
        container.style.transition = 'all 0.3s ease';
        container.style.cursor = 'move';
        
        // Cabeçalho com opção de mover
        const cabecalho = document.createElement('div');
        cabecalho.style.display = 'flex';
        cabecalho.style.justifyContent = 'flex-end';
        cabecalho.style.marginBottom = '8px';
        
        // Botão de fechar
        const btnFechar = document.createElement('span');
        btnFechar.innerHTML = '&times;';
        btnFechar.style.cursor = 'pointer';
        btnFechar.style.fontSize = '16px';
        btnFechar.style.fontWeight = 'bold';
        btnFechar.onclick = () => {
            container.style.display = 'none';
            
            // Adicionar mini-botão para restaurar
            criarBotaoRestaurar();
        };
        
        // Adicionar botão de fechar ao cabeçalho
        cabecalho.appendChild(btnFechar);
        
        // Botões para incrementar manualmente
        const botoes = document.createElement('div');
        botoes.style.display = 'flex';
        botoes.style.flexDirection = 'column';
        botoes.style.gap = '8px';
        
        // Botão de acerto
        const btnAcerto = document.createElement('button');
        btnAcerto.innerHTML = '✓ ACERTO';
        btnAcerto.style.backgroundColor = '#2ecc71';
        btnAcerto.style.color = 'white';
        btnAcerto.style.border = 'none';
        btnAcerto.style.padding = '10px 15px';
        btnAcerto.style.borderRadius = '6px';
        btnAcerto.style.cursor = 'pointer';
        btnAcerto.style.fontWeight = 'bold';
        btnAcerto.style.fontSize = '13px';
        btnAcerto.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.1)';
        btnAcerto.style.textAlign = 'center';
        btnAcerto.style.transition = 'transform 0.2s, background-color 0.2s';
        btnAcerto.onmouseover = function() {
            this.style.backgroundColor = '#27ae60';
            this.style.transform = 'translateY(-2px)';
        };
        btnAcerto.onmouseout = function() {
            this.style.backgroundColor = '#2ecc71';
            this.style.transform = 'translateY(0)';
        };
        btnAcerto.onclick = function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => this.style.transform = 'scale(1)', 100);
            incrementarContador('acerto');
        };
        
        // Botão de erro
        const btnErro = document.createElement('button');
        btnErro.innerHTML = '✗ ERRO';
        btnErro.style.backgroundColor = '#e74c3c';
        btnErro.style.color = 'white';
        btnErro.style.border = 'none';
        btnErro.style.padding = '10px 15px';
        btnErro.style.borderRadius = '6px';
        btnErro.style.cursor = 'pointer';
        btnErro.style.fontWeight = 'bold';
        btnErro.style.fontSize = '13px';
        btnErro.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.1)';
        btnErro.style.textAlign = 'center';
        btnErro.style.transition = 'transform 0.2s, background-color 0.2s';
        btnErro.onmouseover = function() {
            this.style.backgroundColor = '#c0392b';
            this.style.transform = 'translateY(-2px)';
        };
        btnErro.onmouseout = function() {
            this.style.backgroundColor = '#e74c3c';
            this.style.transform = 'translateY(0)';
        };
        btnErro.onclick = function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => this.style.transform = 'scale(1)', 100);
            incrementarContador('erro');
        };
        
        // Botão de desfazer
        const btnUndo = document.createElement('button');
        btnUndo.innerHTML = '↩ DESFAZER';
        btnUndo.style.backgroundColor = '#3498db';
        btnUndo.style.color = 'white';
        btnUndo.style.border = 'none';
        btnUndo.style.padding = '10px 15px';
        btnUndo.style.borderRadius = '6px';
        btnUndo.style.cursor = 'pointer';
        btnUndo.style.fontWeight = 'bold';
        btnUndo.style.fontSize = '13px';
        btnUndo.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.1)';
        btnUndo.style.textAlign = 'center';
        btnUndo.style.transition = 'transform 0.2s, background-color 0.2s';
        btnUndo.onmouseover = function() {
            this.style.backgroundColor = '#2980b9';
            this.style.transform = 'translateY(-2px)';
        };
        btnUndo.onmouseout = function() {
            this.style.backgroundColor = '#3498db';
            this.style.transform = 'translateY(0)';
        };
        btnUndo.onclick = function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => this.style.transform = 'scale(1)', 100);
            desfazerUltimaOperacao();
        };
        
        // Adicionar botões
        botoes.appendChild(btnAcerto);
        botoes.appendChild(btnErro);
        botoes.appendChild(btnUndo);
        
        // Montar o painel
        container.appendChild(cabecalho);
        container.appendChild(botoes);
        
        // Adicionar à página
        document.body.appendChild(container);
        
        // Aplicar a função para arrastar o painel
        aplicarDrag(container, container);
        
        // Efeito de animação na entrada
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        setTimeout(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // Criar botão pequeno para restaurar o painel quando fechado
    function criarBotaoRestaurar() {
        // Verificar se o botão já existe
        if (document.getElementById('tec-contador-restaurar')) {
            return;
        }
        
        const restaurar = document.createElement('div');
        restaurar.id = 'tec-contador-restaurar';
        restaurar.style.position = 'fixed';
        restaurar.style.bottom = '20px';
        restaurar.style.right = '20px';
        restaurar.style.backgroundColor = '#3498db';
        restaurar.style.color = 'white';
        restaurar.style.width = '40px';
        restaurar.style.height = '40px';
        restaurar.style.borderRadius = '50%';
        restaurar.style.display = 'flex';
        restaurar.style.justifyContent = 'center';
        restaurar.style.alignItems = 'center';
        restaurar.style.cursor = 'pointer';
        restaurar.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        restaurar.style.zIndex = '9999';
        restaurar.style.fontSize = '20px';
        restaurar.innerHTML = '⇧';
        restaurar.title = 'Restaurar contador';
        
        restaurar.onclick = function() {
            // Remover o botão de restaurar
            this.remove();
            
            // Mostrar o painel contador
            adicionarBotoes();
        };
        
        document.body.appendChild(restaurar);
    }
    
    // Monitorar cliques no botão RESOLVER
    function monitorarCliques() {
        console.log('Configurando monitoramento de cliques...');
        
        document.addEventListener('click', function(e) {
            // Verificar botão de RESOLVER
            const target = e.target;
            let button = null;
            
            // Verificar se clicou no botão ou em algo dentro dele
            if (target.tagName === 'BUTTON' && target.textContent && 
                target.textContent.includes('RESOLVER')) {
                button = target;
            } else {
                button = target.closest('button');
                if (button && (!button.textContent || !button.textContent.includes('RESOLVER'))) {
                    button = null;
                }
            }
            
            if (button) {
                console.log('Clique em botão RESOLVER detectado!');
                setTimeout(verificarResultado, 1500);
            }
        });
    }
    
    // Verificar resultado atual na página
    function verificarResultado() {
        if (verificandoResultado) return;
        verificandoResultado = true;
        
        try {
            console.log('Verificando resultado na página...');
            
            // ID da questão atual
            const idQuestao = obterIdQuestao();
            console.log(`ID da questão atual: ${idQuestao}`);
            
            // Verificar se já processamos esta questão
            if (questoesProcessadas[idQuestao]) {
                const tipoAnterior = questoesProcessadas[idQuestao];
                console.log(`Questão já processada como "${tipoAnterior}". Ignorando.`);
                verificandoResultado = false;
                return;
            }
            
            // Primeiro verificar se a pergunta já foi respondida
            // Procurar por botões que indiquem que a questão ainda não foi respondida
            let botaoResolver = null;
            const botoes = document.querySelectorAll('button');
            for (let i = 0; i < botoes.length; i++) {
                const botao = botoes[i];
                if (botao.textContent && botao.textContent.includes('RESOLVER') && !botao.disabled) {
                    botaoResolver = botao;
                    break;
                }
            }
            
            // Se o botão RESOLVER ainda está ativo, o usuário não respondeu
            if (botaoResolver && botaoResolver.offsetParent !== null) {
                console.log('Questão ainda não foi respondida (botão RESOLVER presente).');
                verificandoResultado = false;
                return false;
            }
            
            // Verificar se há alguma alternativa selecionada
            const alternativaSelecionada = document.querySelector('input[type="radio"]:checked');
            if (!alternativaSelecionada && !document.body.innerText.includes('Você acertou') && !document.body.innerText.includes('Você errou')) {
                console.log('Nenhuma alternativa selecionada e nenhum feedback de resposta. Ignorando.');
                verificandoResultado = false;
                return false;
            }
            
            // Texto completo da página
            const conteudoPagina = document.body.innerText || '';
            
            // Verificações específicas para acerto - verificar textos exatos
            const acertoDetectado = 
                conteudoPagina.includes('Você acertou') || 
                conteudoPagina.includes('Resposta correta!') ||
                conteudoPagina.includes('Parabéns! Você acertou');
            
            // Verificações específicas para erro - verificar textos exatos
            const erroDetectado = 
                conteudoPagina.includes('Você errou') || 
                conteudoPagina.includes('Resposta incorreta!') ||
                conteudoPagina.includes('Que pena! Você errou');
            
            // Se detectou algum resultado CLARO...
            if (acertoDetectado) {
                console.log('ACERTO detectado com certeza!');
                registrarQuestaoProcessada(idQuestao, 'acerto');
                incrementarContador('acerto', idQuestao);
                verificandoResultado = false;
                return true;
            }
            
            if (erroDetectado) {
                console.log('ERRO detectado com certeza!');
                registrarQuestaoProcessada(idQuestao, 'erro');
                incrementarContador('erro', idQuestao);
                verificandoResultado = false;
                return true;
            }
            
            // Se chegou aqui, não detectou resultado claro
            console.log('Nenhum resultado claro detectado.');
            verificandoResultado = false;
            return false;
            
        } catch (erro) {
            console.error('Erro ao verificar resultado:', erro);
            verificandoResultado = false;
            return false;
        }
    }
    
    // Função para obter ID único da questão atual
    function obterIdQuestao() {
        console.log('Tentando obter ID da questão atual...');
        
        // Procurar pelo ID da questão com # na interface (mais confiável)
        try {
            // Tentar obter o número da questão de forma mais robusta
            // Método 1: Buscar em todo o conteúdo da página por padrões de ID
            const pageContent = document.body.innerHTML;
            const idRegex = /#(\d{6,})/g; // IDs com 6+ dígitos após #
            const matches = [...pageContent.matchAll(idRegex)];
            
            if (matches && matches.length > 0) {
                // Pegar o primeiro ID encontrado
                const id = matches[0][1];
                console.log(`ID da questão encontrado no HTML: #${id}`);
                return id;
            }
            
            // Método 2: Procurar por links e elementos que possam conter o ID
            const elements = document.querySelectorAll('a, span, div, p');
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                const text = element.textContent || '';
                
                // Verificar se o texto contém # seguido de números
                if (text.includes('#')) {
                    const match = text.match(/#(\d+)/);
                    if (match && match[1]) {
                        console.log(`ID da questão encontrado em elemento: #${match[1]}`);
                        return match[1];
                    }
                }
                
                // Verificar atributos href para links
                if (element.tagName === 'A' && element.getAttribute('href')) {
                    const href = element.getAttribute('href');
                    if (href.includes('questao/')) {
                        const match = href.match(/questao\/(\d+)/i);
                        if (match && match[1]) {
                            console.log(`ID da questão encontrado em link: ${match[1]}`);
                            return match[1];
                        }
                    }
                }
            }
            
            // Método 3: Verificar a URL atual
            const urlMatch = window.location.href.match(/questao\/(\d+)/i);
            if (urlMatch && urlMatch[1]) {
                console.log(`ID da questão encontrado pela URL: ${urlMatch[1]}`);
                return urlMatch[1];
            }
            
        } catch (erro) {
            console.error('Erro ao tentar obter ID da questão:', erro);
        }
            
        // Fallback - usar parte da URL que não inclui parâmetros dinâmicos
        const urlBase = window.location.pathname;
        console.log(`Nenhum ID específico encontrado, usando URL: ${urlBase}`);
        return `url_${urlBase}`;
    }
    
    // Incrementar contador de acertos ou erros
    function incrementarContador(tipo, idQuestao = null) {
        // Se não foi fornecido ID, obter o atual
        if (!idQuestao) {
            idQuestao = obterIdQuestao();
        }
        
        console.log(`Incrementando contador de ${tipo} para questão ${idQuestao}`);
        
        // Verificar se a questão já foi processada
        if (questoesProcessadas[idQuestao]) {
            const tipoAnterior = questoesProcessadas[idQuestao];
            console.log(`Questão já processada como "${tipoAnterior}". Ignorando novamente.`);
            verificandoResultado = false;
            return;
        }
        
        // Marcar questão como processada imediatamente para feedback rápido
        registrarQuestaoProcessada(idQuestao, tipo);
        
        // Mostrar feedback visual imediato
        mostrarNotificacao(`${tipo === 'acerto' ? 'Acerto' : 'Erro'} contabilizado!`, false);
        
        // Enviar para o servidor local
        console.log(`Enviando requisição para ${API_URL}`);
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ 
                type: tipo,
                question_info: {
                    id: idQuestao,
                    url: window.location.href
                }
            }),
            onload: function(response) {
                console.log(`Resposta do servidor: ${response.status} ${response.statusText}`);
                console.log(`Dados: ${response.responseText}`);
            },
            onerror: function(error) {
                console.error('Erro ao comunicar com servidor:', error);
                mostrarNotificacao('Erro ao comunicar com o servidor local', true);
                
                // Remover da lista de processadas se houver erro, permitindo nova tentativa
                removerQuestaoProcessada(idQuestao);
            }
        });
    }
    
    // Desfazer última operação
    function desfazerUltimaOperacao() {
        console.log('Desfazendo última operação...');
        
        // Enviar para o servidor local
        console.log(`Enviando requisição para ${UNDO_API_URL}`);
        GM_xmlhttpRequest({
            method: 'POST',
            url: UNDO_API_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                console.log(`Resposta do servidor: ${response.status} ${response.statusText}`);
                
                try {
                    const dados = JSON.parse(response.responseText);
                    
                    if (dados.sucesso) {
                        // A operação foi desfeita com sucesso
                        console.log(`Operação desfeita: ${dados.operacao.tipo} da questão ${dados.operacao.questao.id}`);
                        
                        // Remover da lista de questões processadas
                        if (dados.operacao && dados.operacao.questao && dados.operacao.questao.id) {
                            removerQuestaoProcessada(dados.operacao.questao.id);
                        }
                        
                        mostrarNotificacao('Última operação desfeita!');
                    } else {
                        // Não havia operações para desfazer
                        console.log('Não há operações para desfazer');
                        mostrarNotificacao('Não há operações para desfazer', true);
                    }
                } catch (error) {
                    console.error('Erro ao processar resposta do servidor:', error);
                    mostrarNotificacao('Erro ao processar resposta do servidor', true);
                }
            },
            onerror: function(error) {
                console.error('Erro ao comunicar com servidor:', error);
                mostrarNotificacao('Erro ao comunicar com o servidor local', true);
            }
        });
    }
    
    // Mostrar notificação na tela
    function mostrarNotificacao(mensagem, isError = false) {
        const notificacao = document.createElement('div');
        notificacao.className = 'tec-notificacao' + (isError ? ' erro' : '');
        notificacao.textContent = mensagem;
        document.body.appendChild(notificacao);
        
        // Animar entrada
        setTimeout(() => {
            notificacao.classList.add('mostrar');
        }, 10);
        
        // Remover após alguns segundos
        setTimeout(() => {
            notificacao.classList.remove('mostrar');
            setTimeout(() => {
                notificacao.remove();
            }, 300);
        }, isError ? 5000 : 3000);
    }
    
    // Aplicar a função para arrastar o painel
    function aplicarDrag(container, elemento) {
        let isDragging = false;
        let offsetX, offsetY;
        
        // Adicionar eventos para arrastar
        elemento.addEventListener('mousedown', function(e) {
            // Ignorar se clicou em um botão
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SPAN') {
                return;
            }
            
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            
            // Desativar transições enquanto arrasta
            container.style.transition = 'none';
            
            // Prevenir seleção de texto durante o arrasto
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            // Manter dimensões originais e mudar apenas a posição
            container.style.right = 'auto';
            container.style.bottom = 'auto';
            container.style.left = x + 'px';
            container.style.top = y + 'px';
            
            // Prevenir seleção de texto durante o arrasto
            e.preventDefault();
        });
        
        document.addEventListener('mouseup', function() {
            if (!isDragging) return;
            
            isDragging = false;
            
            // Restaurar transição após terminar de arrastar
            container.style.transition = 'all 0.3s ease';
        });
    }
    
    // Carregar contadores da API
    function carregarContadores() {
        console.log('Carregando contadores da API...');
        
        // Enviar para o servidor local
        const statusUrl = 'https://acssjr.pythonanywhere.com/api/status';
        console.log(`Enviando requisição para ${statusUrl}`);
        GM_xmlhttpRequest({
            method: 'GET',
            url: statusUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                try {
                    console.log(`Resposta do servidor: ${response.status} ${response.statusText}`);
                    
                    // Atualizar contadores
                    const dados = JSON.parse(response.responseText);
                    const acertos = dados.acertos || 0;
                    const erros = dados.erros || 0;
                    
                    document.getElementById('tec-contador-acertos').textContent = acertos;
                    document.getElementById('tec-contador-erros').textContent = erros;
                } catch (error) {
                    console.error('Erro ao processar resposta:', error);
                    mostrarNotificacao('Erro ao processar resposta do servidor', true);
                }
            },
            onerror: function(error) {
                console.error('Erro ao comunicar com servidor:', error);
                mostrarNotificacao('Erro ao comunicar com o servidor local', true);
            }
        });
    }
})();
