-- Send one email through Mail.app — the send loop's only transport.
--
--   osascript scripts/jobs/mail-send.applescript <from> <to> <subject> <bodyFile> [attachmentPath]
--
-- The body comes from a UTF-8 file so quotes, Arabic and newlines survive
-- argv. <from> must be an address on an account configured in Mail.app;
-- anything else fails loudly rather than sending from a default account.
on run argv
	set fromAddr to item 1 of argv
	set toAddr to item 2 of argv
	set subj to item 3 of argv
	set bodyFile to item 4 of argv
	set attachPath to ""
	if (count of argv) ≥ 5 then set attachPath to item 5 of argv

	set bodyText to read (POSIX file bodyFile) as «class utf8»

	tell application "Mail"
		set known to false
		repeat with acct in accounts
			if (email addresses of acct) contains fromAddr then set known to true
		end repeat
		if not known then error "no Mail.app account for " & fromAddr number 1001

		set msg to make new outgoing message with properties {subject:subj, content:bodyText, visible:false}
		tell msg
			set sender to fromAddr
			make new to recipient at end of to recipients with properties {address:toAddr}
			if attachPath is not "" then
				make new attachment with properties {file name:(POSIX file attachPath) as alias} at after the last paragraph of content
			end if
		end tell
		-- Mail uploads the attachment asynchronously; sending too early drops it.
		delay 3
		send msg
	end tell
	return "sent " & toAddr
end run
