-- Remove Outlook.com's lingering Drafts copies of messages the loop sent.
--   osascript scripts/jobs/mail-clean-drafts.applescript <account> <subject> [subject…]
-- Exact subject match only — never touches Abdout's own drafts.
on run argv
	set acctEmail to item 1 of argv
	set subjects to rest of argv
	set n to 0
	tell application "Mail"
		repeat with acct in accounts
			if (email addresses of acct) contains acctEmail then
				repeat with mb in mailboxes of acct
					if name of mb is in {"Drafts", "Draft"} then
						repeat with s in subjects
							set hits to (messages of mb whose subject is (s as string))
							set n to n + (count of hits)
							delete hits
						end repeat
					end if
				end repeat
			end if
		end repeat
	end tell
	return n
end run
