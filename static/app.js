const form = document.getElementById('chat-form');
const promptInput = document.getElementById('prompt');
const conversation = document.getElementById('conversation');
const welcomeScreen = document.getElementById('welcome-screen');
const welcomePrompt = document.getElementById('welcome-prompt');
const chatContainer = document.getElementById('chat-container');

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
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+?)`/g, '<code>$1</code>');
  text = text.replace(/\$(.+?)\$/g, '<span class="math-inline">$1</span>');
  return text.replace(/\n/g, '<br>');
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

function resizeTextarea() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 260)}px`;
}

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
  const placeholder = createMessage('assistant', '<span class="assistant-stream"></span><span class="typing-caret"></span>');
  conversation.appendChild(placeholder);
  scrollToBottom();
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
  promptInput.focus();
}

welcomePrompt.addEventListener('click', openChat);
welcomePrompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openChat();
  }
});

promptInput.addEventListener('input', resizeTextarea);
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const userMessage = createMessage('user', formatMarkdown(prompt));
  conversation.appendChild(userMessage);
  renderMath(userMessage);
  promptInput.value = '';
  resizeTextarea();
  openChat();
  scrollToBottom();

  const assistantStream = appendAssistantPlaceholder();
  const assistantWrapper = assistantStream.closest('.message');
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
    await typeAssistantText(assistantStream, assistantTextResponse);
    const contentWrapper = assistantWrapper.querySelector('.message-content');
    contentWrapper.innerHTML = formatMarkdown(assistantTextResponse);
    renderMath(contentWrapper);
    scrollToBottom();
  } catch (error) {
    const contentWrapper = assistantWrapper.querySelector('.message-content');
    contentWrapper.textContent = 'Unable to get a response. Please try again.';
    console.error(error);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  hydrateExistingMessages();
  if (conversation.children.length > 0) {
    openChat();
  }
});
