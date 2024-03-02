class LoaderAction < ApplicationRecord
  belongs_to :series
  belongs_to :user
  belongs_to :loader
end
