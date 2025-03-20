// ==UserScript==
// @name         TEC Concursos - Contador Simples
// @namespace    http://localhost:5000/
// @version      0.9.6
// @description  Versão simples do contador para o TEC Concursos com detecção automática de resultados
// @author       You
// @match        *://*.tecconcursos.com.br/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('TEC Concursos Counter v0.9.6 iniciado');
    
    // Configurações da API
    const API_URL = 'http://localhost:5000/api/increment';
    const UNDO_API_URL = 'http://localhost:5000/api/undo';
    
    // Chaves para armazenamento local
    const STORAGE_KEY = 'tec_concursos_questoes_processadas';
    const POSITION_KEY = 'tec_contador_posicao';
    
    // Variáveis de controle
    let currentUrl = window.location.href;
    let currentQuestionId = '';
    let contentCheckInterval = null;
    let resultadoObserver = null;
    let resultadoProcessado = false; // Flag para controlar se o resultado já foi processado
    let ultimaQuestaoProcessada = ''; // Armazena a última questão que foi processada automaticamente
    const DEBUG_MODE = false; // Controla a exibição de logs detalhados
    
    // Função para log condicional
    function logDebug(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }
    
    // Inicialização
    function iniciar() {
        console.log('Iniciando TEC Concursos Counter');
        
        // Adicionar estilos CSS
        adicionarEstilos();
        
        // Criar painel flutuante
        inicializarPainel();
        
        // Iniciar monitoramento de mudanças na página
        iniciarMonitoramento();
        
        // Iniciar detecção automática de resultados
        iniciarDeteccaoAutomatica();
    }
    
    // Executar após o carregamento da página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
    
    // Função para adicionar estilos CSS
    function adicionarEstilos() {
        const estilos = `
            #tec-contador-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                width: 60px;
                height: auto;
            }
            
            #tec-contador {
                background-color: rgba(30, 30, 30, 0.7);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                border-radius: 50px;
                padding: 10px 0;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                width: 60px;
            }
            
            .tec-contador-botao {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                font-size: 20px;
                transition: all 0.2s ease;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                margin: 0;
            }
            
            .tec-contador-botao:hover {
                transform: scale(1.1);
            }
            
            .tec-contador-botao:active {
                transform: scale(0.95);
            }
            
            .tec-contador-botao.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .tec-contador-botao.disabled:hover {
                transform: none;
            }
            
            #tec-botao-acerto {
                background-color: #2ecc71;
            }
            
            #tec-botao-erro {
                background-color: #e74c3c;
            }
            
            #tec-botao-desfazer {
                background-color: #3498db;
            }
            
            .tec-notificacao {
                position: fixed;
                bottom: 70px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                animation: fadeIn 0.3s, fadeOut 0.3s 2.7s forwards;
            }
            
            .tec-notificacao.erro {
                background-color: rgba(231, 76, 60, 0.9);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, -20px); }
            }
        `;
        
        // Remover estilos existentes, se houver
        const estiloExistente = document.getElementById('tec-contador-estilos');
        if (estiloExistente) {
            estiloExistente.remove();
        }
        
        // Adicionar novos estilos
        const elementoEstilo = document.createElement('style');
        elementoEstilo.id = 'tec-contador-estilos';
        elementoEstilo.textContent = estilos;
        document.head.appendChild(elementoEstilo);
    }
    
    // Funções de gerenciamento de questões processadas
    function getQuestoesProcessadas() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao obter questões processadas:', error);
            return [];
        }
    }
    
    function saveQuestoesProcessadas(questoes) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(questoes));
        } catch (error) {
            console.error('Erro ao salvar questões processadas:', error);
        }
    }
    
    function isQuestaoJaProcessada(id) {
        if (!id || id === 'desconhecido') return false;
        return getQuestoesProcessadas().includes(id);
    }
    
    function addQuestaoProcessada(id) {
        if (!id || id === 'desconhecido') return;
        
        const questoes = getQuestoesProcessadas();
        if (!questoes.includes(id)) {
            questoes.push(id);
            saveQuestoesProcessadas(questoes);
        }
    }
    
    function removerQuestaoProcessada(id) {
        if (!id || id === 'desconhecido') return false;
        
        const questoes = getQuestoesProcessadas();
        const index = questoes.indexOf(id);
        
        if (index !== -1) {
            questoes.splice(index, 1);
            saveQuestoesProcessadas(questoes);
            return true;
        }
        
        return false;
    }
    
    // Inicialização do painel
    function inicializarPainel() {
        // Remover painel existente, se houver
        const painelExistente = document.getElementById('tec-contador-container');
        if (painelExistente) {
            painelExistente.remove();
        }
        
        // Criar painel
        criarPainelFlutuante();
        
        // Atualizar ID da questão atual
        const infoQuestao = obterInfoQuestao();
        currentQuestionId = infoQuestao.id;
        logDebug('Painel inicializado para a questão:', currentQuestionId);
    }
    
    // Função para monitorar mudanças na página
    function iniciarMonitoramento() {
        // Limpar intervalos existentes
        if (contentCheckInterval) {
            clearInterval(contentCheckInterval);
        }
        
        // 1. Verificar mudanças na URL a cada 500ms
        contentCheckInterval = setInterval(() => {
            // Verificar URL
            const newUrl = window.location.href;
            if (newUrl !== currentUrl) {
                logDebug('Mudança de URL detectada:', newUrl);
                currentUrl = newUrl;
                setTimeout(verificarMudancaDeQuestao, 300);
                return;
            }
            
            // Verificar conteúdo da página
            verificarMudancaDeQuestao();
        }, 500);
        
        // 2. Monitorar cliques em botões de navegação
        document.addEventListener('click', (e) => {
            // Verificar se clicou em links ou botões de navegação
            if (e.target.tagName === 'A' || 
                e.target.closest('a') || 
                e.target.classList.contains('btn-nav') || 
                e.target.closest('.btn-nav')) {
                
                // Agendar verificação após o clique
                setTimeout(verificarMudancaDeQuestao, 500);
            }
        });
        
        // 3. Monitorar mudanças no DOM que possam indicar uma nova questão
        const observer = new MutationObserver(verificarMudancaDeQuestao);
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id']
        });
    }
    
    // Verificar se houve mudança na questão atual
    function verificarMudancaDeQuestao() {
        const novaInfoQuestao = obterInfoQuestao();
        
        // Se a ID da questão mudou, reinicializar o painel
        if (novaInfoQuestao.id && novaInfoQuestao.id !== currentQuestionId) {
            logDebug(`Questão mudou: ${currentQuestionId} -> ${novaInfoQuestao.id}`);
            inicializarPainel();
            
            // Reiniciar as flags de controle
            resultadoProcessado = false;
            
            // Reiniciar a detecção automática para a nova questão
            iniciarDeteccaoAutomatica();
        }
    }
    
    // Função para criar o painel flutuante
    function criarPainelFlutuante() {
        // Criar container externo
        const container = document.createElement('div');
        container.id = 'tec-contador-container';
        
        // Restaurar posição anterior
        const posicaoSalva = localStorage.getItem(POSITION_KEY);
        if (posicaoSalva) {
            try {
                const pos = JSON.parse(posicaoSalva);
                container.style.top = pos.top;
                container.style.right = null;
                container.style.bottom = null;
                container.style.left = pos.left;
            } catch (e) {
                console.error('Erro ao restaurar posição:', e);
            }
        }
        
        // Criar painel interior
        const painel = document.createElement('div');
        painel.id = 'tec-contador';
        
        // Obter ID da questão atual
        const infoQuestao = obterInfoQuestao();
        const questaoId = infoQuestao.id;
        const jaProcessada = isQuestaoJaProcessada(questaoId);
        
        logDebug(`Criando painel para questão ${questaoId}. Já processada: ${jaProcessada}`);
        
        // Botões
        const botaoAcerto = criarBotao('tec-botao-acerto', '✓', function() {
            processarBotao('acerto');
        });
        
        const botaoErro = criarBotao('tec-botao-erro', '✗', function() {
            processarBotao('erro');
        });
        
        const botaoDesfazer = criarBotao('tec-botao-desfazer', '↩', function() {
            desfazerUltimaOperacao();
        });
        
        // Desabilitar botões se questão já processada
        if (jaProcessada) {
            botaoAcerto.classList.add('disabled');
            botaoErro.classList.add('disabled');
        } else {
            // Garantir que os botões estejam habilitados para nova questão
            botaoAcerto.classList.remove('disabled');
            botaoErro.classList.remove('disabled');
        }
        
        painel.appendChild(botaoAcerto);
        painel.appendChild(botaoErro);
        painel.appendChild(botaoDesfazer);
        
        // Adicionar painel ao container
        container.appendChild(painel);
        
        // Adicionar container ao corpo da página
        document.body.appendChild(container);
        
        // Tornar o painel arrastável
        tornarArrastavel(container);
    }
    
    // Processar clique nos botões
    function processarBotao(tipo) {
        const infoQuestao = obterInfoQuestao();
        const questaoId = infoQuestao.id;
        
        // Verificar se já foi processada
        if (isQuestaoJaProcessada(questaoId)) {
            mostrarNotificacao(`Esta questão já foi registrada!`, true);
            return;
        }
        
        // Desabilitar botões após click para evitar cliques rápidos múltiplos
        const botaoAcerto = document.getElementById('tec-botao-acerto');
        const botaoErro = document.getElementById('tec-botao-erro');
        
        if (botaoAcerto) botaoAcerto.classList.add('disabled');
        if (botaoErro) botaoErro.classList.add('disabled');
        
        // Incrementar contador
        incrementarContador(tipo);
    }
    
    // Função auxiliar para criar botões
    function criarBotao(id, texto, callback) {
        const botao = document.createElement('button');
        botao.id = id;
        botao.className = 'tec-contador-botao';
        botao.textContent = texto;
        botao.addEventListener('click', callback);
        return botao;
    }
    
    // Função para tornar o painel arrastável
    function tornarArrastavel(elemento) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const painel = elemento.querySelector('#tec-contador');
        
        if (!painel) return;
        
        painel.style.cursor = 'move';
        painel.addEventListener('mousedown', iniciarArrasto);
        
        function iniciarArrasto(e) {
            e.preventDefault();
            
            // Verificar se clicou em um botão (não iniciar arrasto)
            if (e.target.classList.contains('tec-contador-botao')) {
                return;
            }
            
            // Obter posição do cursor no início
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Adicionar eventos ao documento
            document.addEventListener('mouseup', pararArrasto);
            document.addEventListener('mousemove', arrastar);
        }
        
        function arrastar(e) {
            e.preventDefault();
            
            // Calcular nova posição
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Definir nova posição do elemento
            const novoTop = elemento.offsetTop - pos2;
            const novoLeft = elemento.offsetLeft - pos1;
            
            // Garantir que o elemento não saia da tela
            const maxTop = window.innerHeight - elemento.offsetHeight;
            const maxLeft = window.innerWidth - elemento.offsetWidth;
            
            elemento.style.top = Math.min(Math.max(0, novoTop), maxTop) + "px";
            elemento.style.left = Math.min(Math.max(0, novoLeft), maxLeft) + "px";
            
            // Salvar posição
            salvarPosicao(elemento);
        }
        
        function pararArrasto() {
            // Parar de mover quando o mouse for solto
            document.removeEventListener('mouseup', pararArrasto);
            document.removeEventListener('mousemove', arrastar);
            
            // Salvar posição final
            salvarPosicao(elemento);
        }
        
        // Salvar posição do painel para restaurá-la depois
        function salvarPosicao(el) {
            if (!el.style.top || !el.style.left) return;
            
            const posicao = {
                top: el.style.top,
                left: el.style.left
            };
            
            localStorage.setItem(POSITION_KEY, JSON.stringify(posicao));
        }
    }
    
    // Função para incrementar o contador (acerto/erro)
    function incrementarContador(tipo) {
        logDebug(`Incrementando contador: ${tipo}`);
        
        // Obter informações da questão
        const infoQuestao = obterInfoQuestao();
        
        // Preparar dados para enviar
        const dados = {
            type: tipo,
            question_info: infoQuestao
        };
        
        // Enviar para a API
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(dados),
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    mostrarNotificacao(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrado!`);
                    addQuestaoProcessada(infoQuestao.id);
                } else {
                    mostrarNotificacao(`Erro ao registrar ${tipo}`, true);
                    // Reabilitar botões em caso de erro
                    const botaoAcerto = document.getElementById('tec-botao-acerto');
                    const botaoErro = document.getElementById('tec-botao-erro');
                    
                    if (botaoAcerto) botaoAcerto.classList.remove('disabled');
                    if (botaoErro) botaoErro.classList.remove('disabled');
                }
            },
            onerror: function(error) {
                mostrarNotificacao('Erro ao comunicar com o servidor', true);
                console.error('Erro na requisição:', error);
                
                // Reabilitar botões em caso de erro
                const botaoAcerto = document.getElementById('tec-botao-acerto');
                const botaoErro = document.getElementById('tec-botao-erro');
                
                if (botaoAcerto) botaoAcerto.classList.remove('disabled');
                if (botaoErro) botaoErro.classList.remove('disabled');
            }
        });
    }
    
    // Função para desfazer a última operação
    function desfazerUltimaOperacao() {
        logDebug('Desfazendo última operação');
        
        // Obter informações da questão atual
        const infoQuestao = obterInfoQuestao();
        
        GM_xmlhttpRequest({
            method: 'POST',
            url: UNDO_API_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ action: 'undo' }),
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    const removido = removerQuestaoProcessada(infoQuestao.id);
                    
                    if (removido) {
                        mostrarNotificacao('Operação desfeita para esta questão!');
                        
                        // Reabilitar botões após desfazer
                        const botaoAcerto = document.getElementById('tec-botao-acerto');
                        const botaoErro = document.getElementById('tec-botao-erro');
                        
                        if (botaoAcerto) botaoAcerto.classList.remove('disabled');
                        if (botaoErro) botaoErro.classList.remove('disabled');
                    } else {
                        mostrarNotificacao('Operação desfeita!');
                    }
                } else {
                    mostrarNotificacao('Não há operações para desfazer', true);
                }
            },
            onerror: function(error) {
                mostrarNotificacao('Erro ao comunicar com o servidor', true);
                console.error('Erro na requisição:', error);
            }
        });
    }
    
    // Função para obter informações da questão atual
    function obterInfoQuestao() {
        // Tentar obter o ID da questão da URL ou de elementos da página
        let id = '';
        
        // Método 1: Tentar encontrar elemento com classe 'q-info'
        const qInfoElement = document.querySelector('.q-info');
        if (qInfoElement && qInfoElement.textContent) {
            const match = qInfoElement.textContent.match(/#(\d+)/);
            if (match && match[1]) {
                id = match[1];
                logDebug(`ID encontrado no elemento .q-info: ${id}`);
                return { id, url: window.location.href };
            }
        }
        
        // Método 2: Verificar URL
        if (!id) {
            const urlMatch = window.location.href.match(/\/questao\/(\d+)/);
            if (urlMatch && urlMatch[1]) {
                id = urlMatch[1];
                logDebug(`ID encontrado na URL: ${id}`);
                return { id, url: window.location.href };
            }
        }
        
        // Método 3: Verificar elementos na página com o formato "#NNNNNN"
        if (!id) {
            const textosQuestao = [];
            document.querySelectorAll('h1, h2, h3, p, span, div').forEach(elem => {
                if (elem.textContent) textosQuestao.push(elem.textContent);
            });
            
            for (const texto of textosQuestao) {
                const match = texto.match(/#(\d+)/);
                if (match && match[1]) {
                    id = match[1];
                    logDebug(`ID encontrado no texto da página: ${id}`);
                    break;
                }
            }
        }
        
        return {
            id: id || 'desconhecido',
            url: window.location.href
        };
    }
    
    // Função para iniciar a detecção automática de resultados
    function iniciarDeteccaoAutomatica() {
        logDebug('Iniciando detecção automática de resultados');
        
        // Reiniciar as flags de controle
        resultadoProcessado = false;
        
        // Desconectar observer existente, se houver
        if (resultadoObserver) {
            resultadoObserver.disconnect();
        }
        
        // Criar um novo MutationObserver para detectar resultados
        resultadoObserver = new MutationObserver(() => {
            // Só verificar se ainda não processou o resultado para esta questão
            if (!resultadoProcessado) {
                verificarResultado();
            }
        });
        
        // Observar todo o corpo da página para detectar quando o resultado aparece
        resultadoObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true
        });
        
        // Verificar imediatamente se já existe resultado visível
        verificarResultado();
    }
    
    // Função para verificar o resultado da questão após responder
    function verificarResultado() {
        const infoQuestao = obterInfoQuestao();
        
        // Se a questão já foi processada através do sistema manual, não fazer nada
        if (isQuestaoJaProcessada(infoQuestao.id)) {
            resultadoProcessado = true; // Marcar como processado para evitar verificações adicionais
            return;
        }
        
        // Se esta questão já foi processada automaticamente, não fazer nada
        if (resultadoProcessado && ultimaQuestaoProcessada === infoQuestao.id) {
            return;
        }
        
        // Método nativo para buscar elementos com texto específico
        let acertou = false;
        let errou = false;
        
        // Procurar apenas mensagens de feedback específicas
        // Isso evita falsos positivos ao detectar partes aleatórias da página
        let elementoAcerto = null;
        let elementoErro = null;
        
        // Verificar se existe um elemento com texto exato de "Você acertou!" com ícone de verificação verde
        document.querySelectorAll('div, span, p').forEach(elem => {
            if (elem.textContent && elem.textContent.trim() === 'Você acertou!' || 
                elem.textContent && elem.textContent.includes('Você acertou! Muito bem!')) {
                elementoAcerto = elem;
                logDebug('Elemento de acerto encontrado:', elem);
            }
            else if (elem.textContent && elem.textContent.trim() === 'Você errou!' || 
                     elem.textContent && elem.textContent.includes('Você errou! Gabarito:')) {
                elementoErro = elem;
                logDebug('Elemento de erro encontrado:', elem);
            }
        });
        
        // Verificar resposta com base nos elementos específicos encontrados
        if (elementoAcerto) {
            // Verificar se está próximo a um ícone de verificação verde
            const iconeProximo = elementoAcerto.querySelector('svg, i, img') || 
                                elementoAcerto.parentElement.querySelector('svg, i, img');
            
            if (iconeProximo || elementoAcerto.previousElementSibling || elementoAcerto.nextElementSibling) {
                acertou = true;
                logDebug('Acerto confirmado com ícone próximo');
            }
        }
        
        if (elementoErro) {
            // Verificar se está próximo a um ícone X vermelho
            const iconeProximo = elementoErro.querySelector('svg, i, img') || 
                               elementoErro.parentElement.querySelector('svg, i, img');
            
            if (iconeProximo || elementoErro.previousElementSibling || elementoErro.nextElementSibling) {
                errou = true;
                logDebug('Erro confirmado com ícone próximo');
            }
        }
        
        // Se não encontrou pelos textos exatos, buscar ícones específicos
        if (!acertou && !errou) {
            // Procurar ícones específicos que só aparecem após responder
            const checkIcone = document.querySelector('.check-icon, .success-icon, .acerto-icon');
            const erroIcone = document.querySelector('.error-icon, .times-icon, .erro-icon');
            
            if (checkIcone) {
                // Verificar se o ícone está visível
                const estilo = window.getComputedStyle(checkIcone);
                if (estilo.display !== 'none' && estilo.visibility !== 'hidden') {
                    acertou = true;
                    logDebug('Acerto detectado pelo ícone específico');
                }
            }
            
            if (erroIcone) {
                // Verificar se o ícone está visível
                const estilo = window.getComputedStyle(erroIcone);
                if (estilo.display !== 'none' && estilo.visibility !== 'hidden') {
                    errou = true;
                    logDebug('Erro detectado pelo ícone específico');
                }
            }
        }
        
        // Se ainda não encontrou, verificar padrões específicos do TEC Concursos
        if (!acertou && !errou) {
            // Verificar no padrão exato do TEC Concursos
            // Verifica a existência de elementos ou combinações que só aparecem após responder
            
            // TEC Concursos usa SVG com cores específicas
            const elementosVerdes = Array.from(document.querySelectorAll('svg[fill="green"], div.text-success, .success'));
            const elementosVermelhos = Array.from(document.querySelectorAll('svg[fill="red"], div.text-danger, .danger'));
            
            // Verificar se algum desses elementos tem texto de acerto/erro próximo
            for (const elem of elementosVerdes) {
                if (elem.parentNode && elem.parentNode.textContent.includes('acertou')) {
                    acertou = true;
                    logDebug('Acerto confirmado por padrão TEC Concursos (verde)');
                    break;
                }
            }
            
            for (const elem of elementosVermelhos) {
                if (elem.parentNode && elem.parentNode.textContent.includes('errou')) {
                    errou = true;
                    logDebug('Erro confirmado por padrão TEC Concursos (vermelho)');
                    break;
                }
            }
        }
        
        // Por último, verificar elementos que aparecem APENAS no formulário de resposta
        // Essa verificação não é feita nas áreas de navegação/cabeçalho/rodapé
        if (!acertou && !errou) {
            // Focar apenas no conteúdo principal, ignorando menus e navegação
            const conteudoPrincipal = document.querySelector('.question-content, .question-body, .q-content, main');
            
            if (conteudoPrincipal) {
                // Buscar apenas no conteúdo principal
                if (conteudoPrincipal.textContent.includes('Você acertou!')) {
                    acertou = true;
                    logDebug('Acerto confirmado no conteúdo principal');
                } else if (conteudoPrincipal.textContent.includes('Você errou!')) {
                    errou = true;
                    logDebug('Erro confirmado no conteúdo principal');
                }
            }
        }
        
        // Se encontrou resultado, registrar automaticamente
        if (acertou || errou) {
            console.log(`Resultado detectado automaticamente: ${acertou ? 'ACERTO' : 'ERRO'}`);
            
            // Registrar resultado apenas se a questão tiver um ID válido
            if (infoQuestao.id && infoQuestao.id !== 'desconhecido') {
                // Marcar esta questão como processada para evitar processamento duplicado
                resultadoProcessado = true;
                ultimaQuestaoProcessada = infoQuestao.id;
                
                setTimeout(() => {
                    incrementarContador(acertou ? 'acerto' : 'erro');
                    mostrarNotificacao(`Resultado registrado automaticamente: ${acertou ? 'ACERTO ✓' : 'ERRO ✗'}`);
                    
                    // Desconectar o observer após processar o resultado
                    // para evitar múltiplas detecções na mesma questão
                    if (resultadoObserver) {
                        resultadoObserver.disconnect();
                    }
                }, 500);
            }
        }
    }
    
    // Função para mostrar notificações
    function mostrarNotificacao(mensagem, isErro = false) {
        // Remover notificações existentes
        const notificacoesAnteriores = document.querySelectorAll('.tec-notificacao');
        notificacoesAnteriores.forEach(notif => notif.remove());
        
        // Criar nova notificação
        const notificacao = document.createElement('div');
        notificacao.className = isErro ? 'tec-notificacao erro' : 'tec-notificacao';
        notificacao.textContent = mensagem;
        
        // Adicionar à página
        document.body.appendChild(notificacao);
        
        // Remover após 3 segundos
        setTimeout(() => {
            if (notificacao.parentNode) {
                notificacao.remove();
            }
        }, 3000);
    }
})();
