$(function() {

	'use strict';

	var client = ZAFClient.init(),
		attachments = [], // attachments is "global" so we don't have to get the list repeatedly
		
		COMMENT_PATH = "ticket.comments",

		$container = $('#container'),
		$download = $('#download'),
		$list = $('#list'),
		$message = $('#message'),
		$status = $('#status'),
		$progress = $('#progress'),
		$interface = $('#interface'),
		$expand = $('#expand')
	;

	client.on('app.registered', function(event) {

		$progress.hide();
		findAttachments()
		.then(function() {
			attachments.sort(defaultSort);
			displayAttachments();
			$download.show();
		})
		.catch(function(err) {
			message(err);
			$download.hide();
		})
		.then(function() {
			$container.show();
		});
	});

	client.on('ticket.comments.changed', function(event) {
		// console.log(event);
	});

	$download.on("click", function() {
		hide($interface);
		show($status);

		status("Fetching attachments...");
		
		downloadAttachments()
		.then(function() {
			status("ZIP done!");
			setTimeout(function() {
				hide($status);
				hide($progress);
				$progress.percent = 0;
				show($interface);
			}, 2000);
		})
		.catch(function(err) {
			message(err);
			show($interface);
		})
	});
	
	$message.on("click", function() {
		$list.toggle(0, function() { // expand the list, and...
			resize($container.css("height")); // ...expand the app so you can see the list
		});
	});

	function defaultSort(a, b) {
		return a.filename > b.filename ? 1 : a.filename < b.filename ? -1 : 0;
	}

	function findAttachments() {
		return client
			.get(COMMENT_PATH)
			.then(function(response) {
				attachments = getAllAttachments(response);
				return new Promise(function(resolve, reject) {
					var attachmentsFound = $.isArray(attachments) && attachments.length > 0;
					layout({attachmentsFound: attachmentsFound});
					if (!attachmentsFound) {
						reject("No attachments found in this ticket.");
					} else {
						resolve();
					}
				});
			});
	}

	function getAllAttachments(response) {
		var comments = $.makeArray(response[COMMENT_PATH]);
		var allAttachments = $.map(comments, function(comment) {
			return []
				.concat(comment.imageAttachments)
				.concat(comment.nonImageAttachments);
		});
		return deduplicate(allAttachments);
	}

	function layout(prefs) {
		var attachmentsFound = prefs.attachmentsFound;
		var height = attachmentsFound ? "4rem" : "2rem";
		resize(height);
	}

	function resize(height) {
		client.invoke('resize', { height: height });
	}

	function displayAttachments() {
		var html = $.map(attachments, function(attachment) {
			return (tmpl("attachment-link", attachment));
		});
		$list
			.append(html)
			.toggle();
		message(tmpl("attachment-message", attachments.length));
	}

	function makeZip() {
		var zip = new JSZip();
		$.each(attachments, function(index, attachment) {
			zip.file(
				attachment.filename,
				urlToPromise(attachment.contentUrl),
				{
					binary:true
				}
			);
		});
		return zip;
	}

	function downloadAttachments() {
		return client
		.metadata()
		.then(function(metadata) {
			if (metadata.settings.zip) {
				return makeZip()
					.generateAsync({type:"blob"}, function updateCallback(metadata) {
						var percent = metadata.percent;
						$progress.percent = percent;
						$progress.show();
						status("Making ZIP: " + Math.round(percent) + "%");
					})
					.then(function (blob) {
						client
							.context()
							.then(function(context) {
								var filename = tmpl(
									"attachment-filename",
									createFilenameObject(context.ticketId)
								);
								saveAs(blob, filename);
							});
					});
			} else {
				var downloaded = 0,
					total = attachments.length,
					promises = [];
				$.each(attachments, function(index, attachment) {
					promises.push(new Promise(function(resolve, reject) {
						JSZipUtils.getBinaryContent(attachment.contentUrl, function(err, data) {
							if (err) {
								console.log(err);
								reject(err);
							} else {
								downloaded++;
								$progress.show();
								$progress.percent = downloaded/total * 100;
								status("Downloading " + downloaded + " / " + total + " files");
								saveAs(new Blob([data]), attachment.filename);
								resolve();
							}
						});
					}));
				});
				return Promise.all(promises);
			}
		})
	}

	// create an object with an ID field and all the date fields.
	function createFilenameObject(id) {
		return $.extend(
			{ id: id },
			formatDate(new Date())
		);
	}

	function formatDate(date) {
		return {
			year: date.getFullYear(),
			month: zeroPad(date.getMonth()+1),
			day: zeroPad(date.getDate()),
			hour: zeroPad(date.getHours()),
			minute: zeroPad(date.getMinutes()),
			second: zeroPad(date.getSeconds()),
			millis: date.getMilliseconds()
		}
	}

	function zeroPad(n) {
		return ("0" + n).slice(-2);
	}

	function message(message) {
		display($message, message);
	}
	
	function status(message) {
		display($status, message);
	}

	function display($element, message) {
		$element.html(message);
	}

	function show($element) {
		$element.show(600);
	}

	function hide($element) {
		$element.hide(600);
	}

	/**
	* Set the width of the colored part of the progress bar.
	*/
	Object.defineProperty($progress, "percent", {
		set: function(percent) {
			this
			.find("#progress-bar")
			.attr('aria-valuenow', percent)
			.width(percent+"%");
		}
	});

	/**
	 * Fetch the content and return the associated promise.
	 * @param {String} url the url of the content to fetch.
	 * @return {Promise} the promise containing the data.
	 */
	function urlToPromise(url) {
		return new Promise(function(resolve, reject) {
			JSZipUtils.getBinaryContent(url, function (err, data) {
				if(err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

    /**
        Append a string to filename before the extension.
    */
    function appendStringToFilename(filename, string) {
        var dotIndex = filename.lastIndexOf(".");
        if (dotIndex == -1) {
            return filename + string;   
        } else {
            return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
        }
    }

    // Modified from
    // https://stackoverflow.com/a/34972148/1110820
    // Takes an array of attachments and appends numbers
    // to the filenames to get rid of duplicates.
    // (Like Windows filenames.)
	function deduplicate(attachments) {

		var c = {}, 
		t = function(x, n) { return appendStringToFilename(x, "(" + n + ")"); };
		
		return attachments.map(function(attachment) {
			var n = c[attachment.filename] || 0;			
			c[attachment.filename] = n + 1;

			if (!n) {
				return attachment;
			}
			
			while (c[t(attachment.filename, n)]) {
				n++;
			}
			
			c[t(attachment.filename, n)] = 1;
			attachment.filename = t(attachment.filename, n);
			return attachment;
		});

	}

});