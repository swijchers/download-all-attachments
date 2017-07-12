$(function() {

	'use strict';

	var

		client = ZAFClient.init(),

		attachments = [],

		comment_path = "ticket.comments",

    $container = $('#container'),
		$download = $('#download'),
		$list = $('#list'),
		$message = $('#message'),
		$status = $('#status'),
		$progress = $('#progress'),
		$interface = $('#interface')

	;

	client.on('app.registered', function appRegistered(event) {
		$progress.hide();
		findAttachments()
		.then(function() {
			attachments.sort(function(a,b) {
				return a.filename > b.filename ? 1 : a.filename < b.filename ? -1 : 0;
			});
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
		console.log(event);
	});

	$download.on("click", function() {
		hide($interface);
		show($status);

		status("Fetching attachments...");
		
		downloadAttachments().
		then(function() {
			status("ZIP done!");
			setTimeout(function() {
				hide($status);
				hide($progress);
				$progress.percent = 0;
				show($interface);
			}, 2000);
		});
	});
	
	$message.on("click", function() {
		$list.slideToggle();
	});

	function findAttachments() {
		return client.get(comment_path)
			.then(function(response) {
				var comments = $.makeArray(response[comment_path]);
				var allAttachments = $.map(comments, function(comment) {
					return []
						.concat(comment.imageAttachments)
						.concat(comment.nonImageAttachments);
				});
				attachments = deduplicate(allAttachments);
				return new Promise(function(resolve, reject) {
					if (!$.isArray(attachments) || attachments.length === 0) {
						reject("No attachments found in this ticket.");
					} else {
						resolve();
					}
				});
			});
	}

	function displayAttachments() {
		var html = $.map(attachments, function(attachment) {
			return (
				"<li>" +
				"<a href='"+attachment.contentUrl+"' target='_blank'>"+attachment.filename+"</a>" +
				"</li>"
			)
		});
		$list
		.append(html)
		.toggle();
		message("<span id='count'>" + attachments.length + " attachment" + (attachments.length == 1 ? "" : "s") + "</span> found in this ticket.");
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
		var first = true;
		return makeZip()
		.generateAsync({type:"blob"}, function updateCallback(metadata) {

			if (first) {
				$progress.show();
				first = false;
			}

			var percent = metadata.percent;
			$progress.percent = percent;
			status("Making ZIP: " + percent.toFixed(2) + "%");
		})
		.then(function (blob) {
			client.context().then(function(context) {
				var filename = "Zendesk-";
				filename += context.ticketId;
				filename += "-attachments-";
				filename += new Date().getTime();
				filename += ".zip";
				saveAs(blob, filename);
			})
		});
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