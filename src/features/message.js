async function loadAllMessages(container) {
  let height = 0
  let attempts = 0
  for (let tick = 0; tick < 20; tick++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const { scrollHeight } = container
    container.scrollTop = scrollHeight
    if (scrollHeight > 20000 || (scrollHeight === height && attempts >= 3)) break
    if (scrollHeight === height) attempts++
    height = scrollHeight
  }
}

const selectMessagesForDeletion = async () => {
  const container = document.querySelector(
    '.msg-conversations-container__conversations-list'
  )

  if (!container) {
    alert(
      'No messages. Are you on the messaging page?\n\nIf not, please navigate to messaging using the LinkedIn navbar and then click the Select Messages for Deletion button again.'
    )
    return
  }

  await loadAllMessages(container)
  for (const label of container.getElementsByTagName('label')) {
    label.click()
  }
  alert('Click the trash can icon at the top to delete all messages.')
}

// Add message selection button
export const setupDeleteMessagesButton = async () => {
  console.log('FocusedIn: Waiting for Messages to load')

  const menuContainer = document.querySelector(
    '.msg-conversations-container__dropdown-container > div'
  )

  const observer = new MutationObserver(function () {
    const menu = menuContainer.querySelector('ul')
    if (!menu) return

    const selectMenuItem = document.createElement('div')

    selectMenuItem.classList.add(
      'artdeco-dropdown__item',
      'artdeco-dropdown__item--is-dropdown',
      'ember-view'
    )
    selectMenuItem.textContent = 'Select all for deletion (FocusedIn)'

    selectMenuItem.onclick = function () {
      document
        .querySelector(
          '.msg-conversations-container__title-row button.artdeco-dropdown__trigger'
        )
        .click()
      selectMessagesForDeletion()
    }

    console.log('FocusedIn: Adding "Select messages for deletion" button')

    menu.appendChild(selectMenuItem)
  })

  if (!menuContainer) return

  observer.observe(menuContainer, {
    attributes: false,
    childList: true,
    subtree: false,
    characterData: false,
  })
}
