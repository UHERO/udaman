module Validators

  ## This regex is fairly simplistic, but should cover most cases. I've written it to pass everything that's
  ## currently in our database. Yes, it overmatches, to keep it simple, but in a benign way. Everything following
  ## the domain name is optional, of course.
  BASIC_URL = %r{(https?://                   # secure or insecure connections
                  [a-z0-9]+([-.][a-z0-9]+)*   # domain name
                  (:\d+)?                     # port number
                  (/\^?(\w|[%\w][-.%\w]*\w))*/*   # path following domain name; elements can have initial ^
                  (\?\w+=\^?[-.+%\w]+(&\w+=\^?[-.+%\w]+)*)?  # GET parameters; values can have initial ^
                  (\#\w+)?                    # hash-mark-introduced word
                  )}ix

  ## Only matches basic, simple email addresses (although these should be the majority).
  BASIC_EMAIL_ADDR = %r{(\w+@([a-z0-9]\.|\w[-\w]*\w\.)+[a-z]+)}i

  def valid_url(string)
    string =~ %r{^#{BASIC_URL}$}i
  end

  def valid_download_handle(string)
    string =~ %r{^#{BASIC_EMAIL_ADDR}$}i
  end

  def valid_series_name(string)
    begin
      Series.parse_name(string)
    rescue SeriesNameException
      return false
    end
    true
  end
end
