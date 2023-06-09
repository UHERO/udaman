class ApiApplication < ApplicationRecord
  include Cleaning

  ## this is just a comment to say what this branch is for: it's for adding and editing API keys (and other metadata?),
  ## so that this stuff doesn't have to be done in DbVis or something. After implementing, get rid of this comment.
end
