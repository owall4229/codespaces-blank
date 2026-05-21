const form = document.getElementById('chat-form');
const promptInput = document.getElementById('prompt');
const conversation = document.getElementById('conversation');
const welcomeScreen = document.getElementById('welcome-screen');
const welcomePrompt = document.getElementById('welcome-prompt');
const chatContainer = document.getElementById('chat-container');
const chatListEl = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const generateImageBtn = document.getElementById('generate-image-btn');
const centerPlaceholder = document.getElementById('center-placeholder');
const initialInput = document.getElementById('initial-input');

function escapeHTML(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdown(value) {
  let text = escapeHTML(value);
  const codeBlocks = [];
  text = text.replace(/```\s*([^\r\n`]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang ? lang.toLowerCase().trim() : 'code';
    const header = `<div class="code-header"><span class="code-language">${language || 'code'}</span><button class="copy-code-button" type="button">Copy</button></div>`;
    const block = `<div class="code-block">${header}<pre><code class="language-${language}">${code.replace(/</g, '&lt;')}</code></pre></div>`;
    codeBlocks.push(block);
    return `[[CODE_BLOCK_${codeBlocks.length - 1}]]`;
  });
  text = text.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  text = text.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  text = text.replace(/`([^`]+?)`/g, '<code>$1</code>');
  text = text.replace(/\$(.+?)\$/g, '<span class="math-inline">$1</span>');
  text = text.replace(/\n/g, '<br>');
  return text.replace(/\[\[CODE_BLOCK_(\d+)\]\]/g, (_, idx) => codeBlocks[Number(idx)]);
}

function renderMath(root) {
  if (!window.katex) return;
  root.querySelectorAll('.math-inline').forEach((element) => {
    const expression = element.textContent.trim();
    try {
      katex.render(expression, element, {
        throwOnError: false,
        errorColor: '#f8fafc',
        strict: 'ignore',
        displayMode: false,
      });
    } catch (_error) {
      element.textContent = `$${expression}$`;
    }
  });
}

function hydrateExistingMessages() {
  document.querySelectorAll('.message-content').forEach((content) => {
    const original = content.textContent || '';
    content.innerHTML = formatMarkdown(original);
    renderMath(content);
  });
}

function createImageMessage(url) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.innerHTML = `
    <div class="message-role">Assistant</div>
    <div class="message-content"><div class="image-card"><img src="${url}" alt="AI generated image" /></div></div>
  `;
  return wrapper;
}

conversation.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-code-button');
  if (!button) return;
  const block = button.closest('.code-block');
  const code = block?.querySelector('pre code');
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code.textContent || '');
    const originalLabel = button.textContent;
    button.textContent = 'Copied!';
    button.setAttribute('disabled', '');
    setTimeout(() => {
      button.textContent = originalLabel;
      button.removeAttribute('disabled');
    }, 1400);
  } catch (error) {
    console.error('Clipboard copy failed', error);
  }
});

// Simple local chat storage (client-only)
function loadChats() {
  try {
    return JSON.parse(localStorage.getItem('chats') || '[]');
  } catch (_e) {
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem('chats', JSON.stringify(chats));
}

function generateChatTitle(prompt) {
  const heading = prompt.split('\n').find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, '').trim().slice(0, 36);
  }
  const summary = prompt.split('\n')[0].trim();
  return summary.slice(0, 42) || 'New chat';
}

function deleteChat(id) {
  chats = chats.filter((chat) => chat.id !== id);
  if (selectedChatId === id) {
    selectedChatId = chats.length ? chats[0].id : null;
    localStorage.setItem('selectedChat', selectedChatId || '');
  }
  saveChats(chats);
  renderChatList();
  if (selectedChatId) {
    selectChat(selectedChatId);
  } else {
    conversation.innerHTML = '';
    centerPlaceholder.classList.remove('hidden');
    form.classList.add('hidden');
    form.classList.remove('floating');
    conversation.classList.remove('with-floating');
  }
}

let chats = loadChats();
let selectedChatId = localStorage.getItem('selectedChat') || null;

function renderChatList() {
  chatListEl.innerHTML = '';
  chats.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === selectedChatId ? ' active' : '');
    item.innerHTML = `
      <span class="chat-item-label">${escapeHTML(c.title || 'New chat')}</span>
      <button class="chat-delete-btn" type="button" aria-label="Delete chat">×</button>
    `;
    item.addEventListener('click', () => selectChat(c.id));
    const deleteBtn = item.querySelector('.chat-delete-btn');
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteChat(c.id);
    });
    chatListEl.appendChild(item);
  });
}

function selectChat(id) {
  selectedChatId = id;
  localStorage.setItem('selectedChat', id);
  renderChatList();
  // render messages for selected chat
  const chat = chats.find((x) => x.id === id);
  conversation.innerHTML = '';
  if (chat && chat.messages) {
    chat.messages.forEach((m) => {
      let node;
      if (m.type === 'image') {
        node = createImageMessage(m.content);
      } else {
        node = createMessage(m.role, formatMarkdown(m.content));
        renderMath(node);
      }
      conversation.appendChild(node);
    });
  }
  openChat();
}

function createChat(title) {
  const id = String(Date.now());
  const chat = { id, title: title || 'New chat', messages: [] };
  chats.unshift(chat);
  saveChats(chats);
  renderChatList();
  return chat;
}

function resizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 260)}px`;
}

function resizeTextareas() {
  if (promptInput) resizeTextarea(promptInput);
}

const imageStatusLabel = document.getElementById('image-status');
function showImageStatus(message, duration = 4000) {
  if (!imageStatusLabel) return;
  imageStatusLabel.textContent = message;
  imageStatusLabel.classList.remove('hidden');
  if (duration > 0) {
    clearTimeout(showImageStatus._timeout);
    showImageStatus._timeout = setTimeout(() => {
      imageStatusLabel.classList.add('hidden');
    }, duration);
  }
}

function hideImageStatus() {
  if (!imageStatusLabel) return;
  imageStatusLabel.classList.add('hidden');
  clearTimeout(showImageStatus._timeout);
}

function positionFloatingComposer() {
  if (!form.classList.contains('floating')) return;
  const sidebar = document.querySelector('.sidebar');
  const gap = 16;
  if (!sidebar || window.innerWidth <= 860) {
    form.style.left = `${gap}px`;
    form.style.right = `${gap}px`;
  } else {
    const rect = sidebar.getBoundingClientRect();
    const left = Math.max(rect.right + gap, gap);
    form.style.left = `${left}px`;
    form.style.right = `32px`;
  }
}


window.addEventListener('resize', () => {
  positionFloatingComposer();
});
function createMessage(role, htmlContent) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  wrapper.innerHTML = `
    <div class="message-role">${role === 'user' ? 'You' : 'Assistant'}</div>
    <div class="message-content">${htmlContent}</div>
  `;
  return wrapper;
}

function appendAssistantPlaceholder() {
  const thinkingSpan = '<span class="assistant-thinking"></span>';
  const placeholder = createMessage('assistant', thinkingSpan + '<span class="assistant-stream"></span><span class="typing-caret"></span>');
  conversation.appendChild(placeholder);
  scrollToBottom();
  const thinkingEl = placeholder.querySelector('.assistant-thinking');
  // start thinking phrases
  const phrases = [
    'Thinking...',
    'Synthesizing a helpful response...',
    'Crunching the knowledge...',
    'Formulating ideas...',
    'Almost there...'
  ];
  let pi = 0;
  thinkingEl.textContent = phrases[pi];
  thinkingEl._thinkingInterval = setInterval(() => {
    pi = (pi + 1) % phrases.length;
    thinkingEl.textContent = phrases[pi];
  }, 1800);
  return placeholder.querySelector('.assistant-stream');
}

function scrollToBottom() {
  conversation.scrollTop = conversation.scrollHeight;
}

function typeAssistantText(targetElement, text) {
  return new Promise((resolve) => {
    let index = 0;
    const prefix = text.slice(0, 0);
    targetElement.textContent = prefix;
    const interval = setInterval(() => {
      index += 1;
      targetElement.textContent = text.slice(0, index);
      scrollToBottom();
      if (index >= text.length) {
        clearInterval(interval);
        resolve();
      }
    }, 12 + Math.random() * 12);
  });
}

function openChat() {
  welcomeScreen.classList.add('collapsed');
  chatContainer.classList.add('visible');
  chatContainer.removeAttribute('aria-hidden');
  // ensure composer visible and positioned
  centerPlaceholder.classList.add('hidden');
  form.classList.remove('hidden');
  form.classList.add('floating');
  positionFloatingComposer();
  conversation.classList.add('with-floating');
  promptInput.focus();
}

welcomePrompt.addEventListener('click', openChat);
welcomePrompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openChat();
  }
});

promptInput.addEventListener('input', resizeTextareas);
promptInput.addEventListener('input', resizeTextareas);
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

generateImageBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showImageStatus('Type a prompt first, then click the image button to generate an image.', 5000);
    return;
  }
  showImageStatus('Image request received. Generating your image now. You will see it added to the chat when ready.', 0);
  generateImageBtn.disabled = true;
  generateImageBtn.textContent = 'Generating...';
  try {
    const response = await fetch('/api/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ prompt }),
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = responseBody?.detail || response.statusText || 'Unable to generate image.';
      throw new Error(detail);
    }
    const imageUrl = responseBody?.image_url;
    if (!imageUrl) {
      throw new Error('Image generation returned no image URL.');
    }
    const imageMessage = createImageMessage(imageUrl);
    conversation.appendChild(imageMessage);
    if (!selectedChatId) {
      const newChat = createChat();
      selectedChatId = newChat.id;
      localStorage.setItem('selectedChat', selectedChatId);
      renderChatList();
    }
    const chat = chats.find((x) => x.id === selectedChatId);
    if (chat) {
      if (!chat.title || chat.title === 'New chat') {
        chat.title = generateChatTitle(prompt);
      }
      chat.messages.push({ role: 'assistant', type: 'image', content: imageUrl });
      saveChats(chats);
      renderChatList();
    }
    resizeTextareas();
    openChat();
    scrollToBottom();
    showImageStatus('Image generated successfully! Scroll the conversation to view it, or enter another prompt to continue.', 5000);
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Unable to generate the image. Try adjusting your prompt or try again in a moment.';
    showImageStatus(message, 10000);
  } finally {
    generateImageBtn.disabled = false;
    generateImageBtn.textContent = '🖼️';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  // If there's no selected chat (user clicked center input), create chat only on submit
  if (!selectedChatId) {
    const newChat = createChat();
    selectedChatId = newChat.id;
    localStorage.setItem('selectedChat', selectedChatId);
    renderChatList();
  }

  // append user message to UI and store
  const userMessage = createMessage('user', formatMarkdown(prompt));
  conversation.appendChild(userMessage);
  renderMath(userMessage);
  const chat = chats.find((x) => x.id === selectedChatId);
  if (chat) {
    if (!chat.title || chat.title === 'New chat') {
      chat.title = generateChatTitle(prompt);
    }
    chat.messages.push({ role: 'user', content: prompt });
    saveChats(chats);
    renderChatList();
  }

  promptInput.value = '';
  resizeTextarea();
  openChat();
  scrollToBottom();

  const assistantStream = appendAssistantPlaceholder();
  const assistantWrapper = assistantStream.closest('.message');
  const thinkingEl = assistantWrapper.querySelector('.assistant-thinking');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Server error: ' + response.statusText);
    }

    const assistantTextResponse = await response.text();
    // stop thinking animation if present
    if (thinkingEl && thinkingEl._thinkingInterval) {
      clearInterval(thinkingEl._thinkingInterval);
      thinkingEl.remove();
    }
    await typeAssistantText(assistantStream, assistantTextResponse);
    const contentWrapper = assistantWrapper.querySelector('.message-content');
    contentWrapper.innerHTML = formatMarkdown(assistantTextResponse);
    renderMath(contentWrapper);
    scrollToBottom();

    if (chat) {
      chat.messages.push({ role: 'assistant', content: assistantTextResponse });
      saveChats(chats);
    }
  } catch (error) {
    const contentWrapper = assistantWrapper.querySelector('.message-content');
    contentWrapper.textContent = 'Unable to get a response. Please try again.';
    console.error(error);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  hydrateExistingMessages();
  // render saved chats
  renderChatList();

  if (conversation.children.length > 0) {
    openChat();
  } else {
    // show placeholder center input
    centerPlaceholder.classList.remove('hidden');
  }
});

// Clicking the center rounded input will animate composer to bottom but not create a chat yet
initialInput.addEventListener('click', () => {
  centerPlaceholder.classList.add('hidden');
  form.classList.remove('hidden');
  form.classList.add('floating');
  positionFloatingComposer();
  conversation.classList.add('with-floating');
  setTimeout(() => promptInput.focus(), 120);
});

// New chat button creates and selects a new chat immediately
newChatBtn.addEventListener('click', () => {
  const c = createChat('New chat');
  selectChat(c.id);
  form.classList.remove('hidden');
  form.classList.add('floating');
  positionFloatingComposer();
  conversation.classList.add('with-floating');
  setTimeout(() => promptInput.focus(), 120);
});

