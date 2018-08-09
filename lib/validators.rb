module Validators

  def valid_url(string)
    ## This regex is fairly simplistic, but should cover most cases. I've written it to pass everything that's
    ## currently in our database. Yes, it overmatches, to keep it simple, but in a benign way. Everything following
    ## the domain name is optional, of course.
    string =~ %r{^https?://                   # secure or insecure connections
                  [a-z0-9]+([-.][a-z0-9]+)*   # domain name
                  (:\d+)?                     # port number
                  (/(\w[-.\w]*\w)?)*          # path following domain name
                  (\?\w+=\^?[-.+%\w]+(&\w+=\^?[-.+%\w]+)*)?  # GET parameters
                  (\#\w+)?                    # hash-mark-introduced word
                  $}ix
  end

end
