const form = document.getElementById('chat-form');
const promptInput = document.getElementById('prompt');
const conversation = document.getElementById('conversation');

function resizeTextarea() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 200)}px`;
}

promptInput.addEventListener('input', resizeTextarea);
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

function createMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  wrapper.innerHTML = `
    <div class="message-role">${role === 'user' ? 'You' : 'Assistant'}</div>
    <div class="message-content"></div>
  `;
  wrapper.querySelector('.message-content').textContent = content;
  return wrapper;
}

function appendAssistantPlaceholder() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.innerHTML = `
    <div class="message-role">Assistant</div>
    <div class="message-content typing"></div>
  `;
  conversation.appendChild(wrapper);
  conversation.scrollTop = conversation.scrollHeight;
  return wrapper.querySelector('.message-content');
}

function scrollToBottom() {
  conversation.scrollTop = conversation.scrollHeight;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const userMessage = createMessage('user', prompt);
  conversation.appendChild(userMessage);
  promptInput.value = '';
  promptInput.focus();
  scrollToBottom();

  const assistantBubble = appendAssistantPlaceholder();
  let assistantText = '';

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
    assistantBubble.textContent = assistantTextResponse;
    scrollToBottom();
  } catch (error) {
    assistantBubble.textContent = 'Unable to get a response. Please try again.';
    console.error(error);
  }
});
