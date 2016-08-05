class ApiUser < ActiveRecord::Base
  validates :key, presence: true

end
