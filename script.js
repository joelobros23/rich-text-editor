/**
 * RichTextEditorAPI
 * An API to interact with the rich text editor.
 */
class RichTextEditorAPI {
    constructor(editorContainerId) {
        this.container = document.getElementById(editorContainerId);
        if (!this.container) {
            console.error(`Editor container with id "${editorContainerId}" not found.`);
            return;
        }

        // Core elements
        this.editor = this.container.querySelector('#editor');
        this.toolbar = this.container.querySelector('.toolbar');
        
        // Modals
        this.codeModal = document.getElementById('code-modal');
        this.linkModal = document.getElementById('link-modal');

        // State
        this.savedRange = null;

        this.init();
    }

    init() {
        if (!this.editor || !this.toolbar) return;
        
        this.initToolbarListeners();
        this.initEditorListeners();
        this.initModalListeners();

        document.execCommand('defaultParagraphSeparator', false, 'p');
        this.updateToolbar();
    }

    initToolbarListeners() {
        this.toolbar.addEventListener('mousedown', (e) => {
            const button = e.target.closest('button');
            if (button) {
                e.preventDefault();
                if (button.dataset.command) {
                    this.executeCommand(button.dataset.command);
                } else if (button.id === 'create-link-btn') {
                    this.showLinkModal();
                } else if (button.id === 'view-code-btn') {
                    this.showCodeModal();
                }
            }
        });
        
        this.toolbar.addEventListener('change', (e) => {
            const select = e.target.closest('select');
            if (!select) return;

            // *** FIX: Correctly handle different select elements ***
            if (select.dataset.command) {
                // For formatBlock and fontName
                this.executeCommand(select.dataset.command, select.value);
            } else if (select.id === 'line-height-select') {
                // For line height
                this.setLineHeight(select.value);
            }
        });

        this.toolbar.querySelectorAll('.color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.executeCommand(e.target.dataset.command, e.target.value);
            });
        });
    }
    
    initEditorListeners() {
        const update = () => this.updateToolbar();
        document.addEventListener('selectionchange', update);
        this.editor.addEventListener('click', update);
        this.editor.addEventListener('keyup', update);
        this.editor.addEventListener('focus', update);

        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.execCommand('insertParagraph');
            }
        });
    }

    initModalListeners() {
        // Code Modal
        document.getElementById('close-code-modal-btn').addEventListener('click', () => this.hideCodeModal());
        document.getElementById('copy-code-btn').addEventListener('click', () => this.copyCodeToClipboard());
        this.codeModal.addEventListener('click', (e) => { if (e.target === this.codeModal) this.hideCodeModal(); });

        // Link Modal
        const linkUrlInput = document.getElementById('link-url-input');
        document.getElementById('close-link-modal-btn').addEventListener('click', () => this.hideLinkModal());
        document.getElementById('apply-link-btn').addEventListener('click', () => this.applyLink());
        this.linkModal.addEventListener('click', (e) => { if (e.target === this.linkModal) this.hideLinkModal(); });
        linkUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.applyLink(); } });
        
        // General
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.codeModal.classList.contains('hidden')) this.hideCodeModal();
            if (e.key === 'Escape' && !this.linkModal.classList.contains('hidden')) this.hideLinkModal();
        });
    }

    // --- Commands ---
    executeCommand(command, value = null) {
        document.execCommand(command, false, value);
        this.editor.focus();
        this.updateToolbar();
    }
    
    setLineHeight(value) {
        if (!value) return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const block = this.findParentBlock(selection.anchorNode);
        if (block) {
            block.style.lineHeight = value;
        }
        this.editor.focus();
        this.updateToolbar();
    }
    
    // --- Modals Logic ---
    showCodeModal() {
        document.getElementById('html-code-display').textContent = this.getContent();
        this.codeModal.classList.remove('hidden');
    }

    hideCodeModal() {
        this.codeModal.classList.add('hidden');
        this.editor.focus();
    }
    
    showLinkModal() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        this.savedRange = selection.getRangeAt(0).cloneRange();

        const linkUrlInput = document.getElementById('link-url-input');
        const parentLink = this.findParentBlock(selection.anchorNode, 'A');
        linkUrlInput.value = parentLink ? parentLink.href : '';
        
        this.linkModal.classList.remove('hidden');
        linkUrlInput.focus();
    }

    hideLinkModal() {
        this.linkModal.classList.add('hidden');
        this.editor.focus();
    }
    
    applyLink() {
        const url = document.getElementById('link-url-input').value;
        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }
        if (url) {
            this.executeCommand('createLink', url);
        } else {
            this.executeCommand('unlink');
        }
        this.hideLinkModal();
    }

    copyCodeToClipboard() {
        const code = document.getElementById('html-code-display').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copy-code-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
        });
    }

    // --- State & Updates ---
    findParentBlock(node, tagName = null) {
        let currentNode = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        while (currentNode && currentNode !== this.editor) {
            const isMatch = tagName ? currentNode.tagName === tagName : window.getComputedStyle(currentNode).display.includes('block');
            if (isMatch) return currentNode;
            currentNode = currentNode.parentNode;
        }
        return null;
    }
    
    updateToolbar() {
        this.toolbar.querySelectorAll('[data-command]').forEach(el => {
            if (el.tagName === 'BUTTON') {
                el.classList.toggle('active', document.queryCommandState(el.dataset.command));
            } else if (el.tagName === 'SELECT') {
                 try {
                    const value = document.queryCommandValue(el.dataset.command).replace(/['"]/g, '');
                    el.value = value || 'Arial'; // Fallback for fontName
                 } catch (e) { /* Some commands might fail in some browsers */ }
            }
        });
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const parentBlock = this.findParentBlock(selection.anchorNode);
        this.toolbar.querySelector('#line-height-select').value = parentBlock ? parentBlock.style.lineHeight || '' : '';
        
        const parentLink = this.findParentBlock(selection.anchorNode, 'A');
        document.getElementById('create-link-btn').classList.toggle('active', !!parentLink);
    }

    getContent() { return this.editor.innerHTML; }
    setContent(htmlContent) { this.editor.innerHTML = htmlContent; this.updateToolbar(); }
}

window.addEventListener('load', () => { window.editorInstance = new RichTextEditorAPI('rich-text-editor-api'); });
